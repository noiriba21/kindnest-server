import "dotenv/config";
import dns from "node:dns";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import { jwtVerify, createRemoteJWKSet } from "jose";

// Shudhu "mongodb+srv" link hole DNS fix lage
if (process.env.MONGODB_URI?.startsWith("mongodb+srv")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db("kindnest");
const events = db.collection("events");
const joins = db.collection("joins");

// Bangladesh time onujayi aajker tarikh, jemon "2026-11-02"
const today = () =>
  new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Wristband (JWT) checker
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

async function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Please log in first" });
    const { payload } = await jwtVerify(token, JWKS);
    req.user = { email: payload.email, name: payload.name };
    next();
  } catch (err) {
    console.log("JWT error:", err.message);
    res.status(401).json({ message: "Your login expired. Please log in again" });
  }
}

app.get("/", (req, res) => res.send("Kitchen is open!"));

app.get("/health", async (req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ message: "Fridge is connected!" });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Cannot reach the fridge" });
  }
});

// PUBLIC: upcoming events
app.get("/events", async (req, res) => {
  try {
    const { limit = 0, search = "", type = "" } = req.query;
    const query = { eventDate: { $gte: today() } };
    if (search) {
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.title = { $regex: safe, $options: "i" };
    }
    if (type) query.eventType = String(type);
    const list = await events
      .find(query)
      .sort({ eventDate: 1 })
      .limit(Number(limit) || 0)
      .toArray();
    res.json(list);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Could not load events" });
  }
});

// PUBLIC: one event
app.get("/events/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "This event id is not valid" });
    }
    const event = await events.findOne({ _id: new ObjectId(req.params.id) });
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Could not load this event" });
  }
});
// ----- helpers for validation -----
const cleanEvent = (b = {}) => ({
  title: String(b.title || "").trim(),
  description: String(b.description || "").trim(),
  eventType: String(b.eventType || "").trim(),
  thumbnail: String(b.thumbnail || "").trim(),
  location: String(b.location || "").trim(),
  eventDate: String(b.eventDate || "").trim(),
});

function checkEvent(e) {
  if (Object.values(e).some((v) => !v)) return "All fields are required";
  if (e.title.length < 5) return "Title must be at least 5 characters";
  if (e.description.length < 20) return "Description must be at least 20 characters";
  if (!/^https?:\/\//.test(e.thumbnail)) return "Thumbnail must be an http or https link";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.eventDate)) return "Event date is not valid";
  if (e.eventDate <= today()) return "Event date must be in the future";
  return null;
}

// PRIVATE: create event
app.post("/events", verifyToken, async (req, res) => {
  try {
    const data = cleanEvent(req.body);
    const problem = checkEvent(data);
    if (problem) return res.status(400).json({ message: problem });
    const result = await events.insertOne({
      ...data,
      creatorEmail: req.user.email,
      creatorName: req.user.name,
      createdAt: new Date(),
    });
    res.status(201).json(result);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Could not create the event" });
  }
});

// PRIVATE: my own events
app.get("/my-events", verifyToken, async (req, res) => {
  try {
    const list = await events
      .find({ creatorEmail: req.user.email })
      .sort({ eventDate: 1 })
      .toArray();
    res.json(list);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Could not load your events" });
  }
});
// PRIVATE: update (only the owner)
app.put("/events/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "This event id is not valid" });
    }
    const data = cleanEvent(req.body);
    const problem = checkEvent(data);
    if (problem) return res.status(400).json({ message: problem });
    const result = await events.updateOne(
      { _id: new ObjectId(req.params.id), creatorEmail: req.user.email },
      { $set: data }
    );
    if (!result.matchedCount) {
      return res.status(403).json({ message: "You can only edit your own events" });
    }
    res.json({ message: "Event updated" });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Could not update the event" });
  }
});

// PRIVATE: delete (only the owner)
app.delete("/events/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "This event id is not valid" });
    }
    const result = await events.deleteOne({
      _id: new ObjectId(req.params.id),
      creatorEmail: req.user.email,
    });
    if (!result.deletedCount) {
      return res.status(403).json({ message: "You can only delete your own events" });
    }
    await joins.deleteMany({ eventId: req.params.id });
    res.json({ message: "Event deleted" });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Could not delete the event" });
  }
});
// PRIVATE: join an event
app.post("/events/:id/join", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "This event id is not valid" });
    }
    const event = await events.findOne({ _id: new ObjectId(req.params.id) });
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.eventDate < today()) {
      return res.status(400).json({ message: "This event has already ended" });
    }
    const already = await joins.findOne({
      eventId: req.params.id,
      userEmail: req.user.email,
    });
    if (already) {
      return res.status(409).json({ message: "You already joined this event" });
    }
    await joins.insertOne({
      eventId: req.params.id,
      userEmail: req.user.email,
      userName: req.user.name,
      title: event.title,
      thumbnail: event.thumbnail,
      location: event.location,
      eventType: event.eventType,
      eventDate: event.eventDate,
      joinedAt: new Date(),
    });
    res.status(201).json({ message: "Joined!" });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Could not join the event" });
  }
});
// PRIVATE: events I joined, sorted by date
app.get("/joined", verifyToken, async (req, res) => {
  try {
    const list = await joins
      .find({ userEmail: req.user.email })
      .sort({ eventDate: 1 })
      .toArray();
    res.json(list);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Could not load joined events" });
  }
});
// PRIVATE: kindness points and badge
app.get("/impact", verifyToken, async (req, res) => {
  try {
    const joined = await joins.countDocuments({ userEmail: req.user.email });
    const created = await events.countDocuments({ creatorEmail: req.user.email });
    const points = joined * 10 + created * 20;
    const badge = points >= 100 ? "🌳 Hero" : points >= 40 ? "🌿 Helper" : "🌱 Seedling";
    res.json({ joined, created, points, badge });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Could not load kindness points" });
  }
});
// ---- NEW ROUTES WILL GO ABOVE THIS LINE ----

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log("Kitchen open on", port);
});