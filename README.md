# KindNest Server

Express.js and MongoDB API for KindNest, a social development events platform.

Live site: https://kindnest-client-mauve.vercel.app/

## What it does
- Public routes for upcoming events and event details
- JWT protected routes to create, update, delete and join events
- Only the owner of an event can update or delete it
- Kindness points and badges API

## Run it
npm install, add a `.env` file with MONGODB_URI and CLIENT_URL, then run `node index.js`