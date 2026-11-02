import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db("kindnest");

app.get("/", (req, res) => {
  res.send("Kitchen is open!");
});

// Fridge connected kina check korar route
app.get("/health", async (req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ message: "Fridge is connected!" });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Cannot reach the fridge" });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log("Kitchen open on", port);
});