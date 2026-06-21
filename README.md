# Trao AI Travel Planner

Next.js + Tailwind frontend with a Node.js + Express + MongoDB backend for multi-user AI travel planning.

## Stack

- Frontend: Next.js, React, Tailwind CSS
- Backend: Node.js, Express
- Database: MongoDB + Mongoose
- Auth: JWT + bcryptjs
- AI: Google Gemini API

## Features

- Register/login
- User-isolated trip storage
- AI itinerary generation
- Budget estimation
- Editable itinerary
- Hotel suggestions
- Weather-aware packing assistant
- Professional itinerary export (PDF/HTML)

## Creative feature

The packing assistant generates a climate- and activity-aware checklist so travelers pack less guesswork and more what they actually need.

## Local setup

### Backend

1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env`
4. Set `MONGO_URI`, `JWT_SECRET`, and `GEMINI_API_KEY`
5. `npm run dev`

### Frontend

1. `cd frontend`
2. `npm install`
3. Set `NEXT_PUBLIC_API_URL`
4. `npm run dev`

## Environment variables

Backend:

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `GEMINI_API_KEY`

Frontend:

- `NEXT_PUBLIC_API_URL`

## Architecture

- Auth routes issue JWTs.
- Trip routes are protected by JWT middleware.
- Every trip query filters by `userId`.
- Gemini generates structured JSON that is stored in MongoDB.

## Limitations

- Requires a live MongoDB connection and Gemini API key for trip generation.
- Hotel and packing outputs depend on AI response quality.
