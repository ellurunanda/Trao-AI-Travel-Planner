# Trao AI Travel Planner

Trao is a full-stack AI travel planning app where users can create trips, get AI-generated itineraries, edit plans, manage packing lists, and export polished trip documents.

---

## Features

- JWT-based user authentication (register/login)
- Multi-user trip isolation (each user sees only their own trips)
- AI-powered trip generation with:
  - day-wise itinerary
  - destination-aware transport options
  - hotel suggestions
  - budget estimation
  - destination-specific packing list
- Edit support:
  - regenerate a single day with feedback
  - add/remove activities
  - toggle packing checklist completion
- Trip management:
  - view all trips
  - select active trip
  - delete trip with custom confirmation dialog
- Export:
  - professional HTML itinerary download
  - professional PDF itinerary download

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Auth | JWT, bcryptjs |
| AI | Google Gemini API |
| PDF Export | jsPDF |

---

## Project Structure

```text
Trao AI Travel Planner/
├─ backend/
│  ├─ config/
│  ├─ controllers/
│  ├─ middleware/
│  ├─ models/
│  ├─ routes/
│  ├─ .env.example
│  └─ server.js
└─ frontend/
   ├─ src/
   │  ├─ app/
   │  ├─ components/
   │  └─ utils/
   ├─ jsconfig.json
   └─ package.json
```

---

## Prerequisites

- Node.js 18+ (recommended LTS)
- npm
- MongoDB (local or Atlas)
- Gemini API key

---

## Environment Setup

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and set:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/trao
JWT_SECRET=change-me
GEMINI_API_KEY=your-gemini-api-key
EXTERNAL_API_TIMEOUT_MS=90000
```

### Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

> Never commit `.env` or `.env.local` files.

---

## Local Development

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Start backend

```bash
cd backend
npm run dev
```

Backend runs on `http://localhost:5000`.

### 3. Start frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:3000`.

---

## Available Scripts

### Backend

- `npm run dev` — start backend with nodemon
- `npm start` — start backend with node

### Frontend

- `npm run dev` — clean `.next` and run Next.js on port 3000
- `npm run build` — clean `.next` and build production bundle
- `npm start` — run production server on port 3000
- `npm run clean` — remove `.next` directory

---

## Core API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Trips (protected)

- `GET /api/trips`
- `POST /api/trips`
- `GET /api/trips/:id`
- `PUT /api/trips/:id`
- `DELETE /api/trips/:id`
- `POST /api/trips/:id/activities`
- `DELETE /api/trips/:id/activities`
- `POST /api/trips/:id/days/:dayNumber/regenerate`
- `POST /api/trips/:id/packing-list`

Health check:

- `GET /health`

---

## Usage Flow

1. Register or login.
2. Create a trip (destination, origin, transport mode, days, budget, interests).
3. Review AI-generated itinerary.
4. Refine plan (regenerate day, edit activities, update packing).
5. Export itinerary as professional HTML or PDF.

---

## Notes

- Transport mode auto-switches to Flight for international destinations in the form (can be overridden).
- AI output quality depends on prompt response quality from Gemini.
- Trip data is always filtered by authenticated `userId` in backend queries.
