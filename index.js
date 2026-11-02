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

// ---- NEW ROUTES WILL GO ABOVE THIS LINE ----

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log("Kitchen open on", port);
});