import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import "dotenv/config";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

const makeEvent = (title, eventType, location, eventDate, description, pic) => ({
  title,
  eventType,
  location,
  eventDate,
  description,
  thumbnail: `https://picsum.photos/seed/${pic}/600/400`,
  creatorEmail: "demo@kindnest.com",
  creatorName: "KindNest Team",
  createdAt: new Date(),
});

const sample = [
  makeEvent("Winter Clothes Distribution", "Donation", "Mirpur 10, Dhaka", "2026-11-15",
    "Join us to give warm clothes and sweaters to families who feel the cold most at night.", "winter"),
  makeEvent("Blanket Distribution for the Needy", "Donation", "Mohammadpur, Dhaka", "2026-11-22",
    "We will hand out blankets to people sleeping outside. Bring a friend and a smile.", "blanket"),
  makeEvent("Patenga Beach Cleanup", "Cleanup", "Patenga, Chattogram", "2026-11-29",
    "Let us pick up plastic and bottles together so the sea and the sand stay clean.", "beach"),
  makeEvent("Tree Plantation Day", "Plantation", "Hathazari, Chattogram", "2026-12-06",
    "We will plant 200 little trees near the school field. Gloves and water are provided.", "trees"),
  makeEvent("Food Pack for Street Children", "Donation", "Kamalapur, Dhaka", "2026-12-13",
    "Pack and share warm meals with street children. Every small pack makes a big smile.", "food"),
  makeEvent("Lake Side Cleanup", "Cleanup", "Dhanmondi Lake, Dhaka", "2026-12-20",
    "Help us clear the lake side path so families can walk and play in a clean place.", "lake"),
  makeEvent("Library Book Drive", "Education", "Agrabad, Chattogram", "2027-01-10",
    "Bring story books you no longer read. We will build a free library for kids.", "books"),
  // Ei event ta purono. Upcoming page-e eta DEKHA JABE NA. Eta-i test!
  makeEvent("Old Test Event", "Cleanup", "Somewhere, Dhaka", "2026-10-20",
    "This event is already over, so it must stay hidden from the upcoming list.", "old"),
];

try {
  const events = client.db("kindnest").collection("events");
  await events.deleteMany({ creatorEmail: "demo@kindnest.com" });
  const result = await events.insertMany(sample);
  console.log("Added", result.insertedCount, "events");
} catch (err) {
  console.log("Seed failed:", err.message);
} finally {
  await client.close();
}