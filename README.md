# Trao AI Travel Planner

Trao is a full-stack AI travel planner that generates editable itineraries, destination-aware packing, and export-ready trip documents.

## Features

- Secure auth with JWT (register/login)
- User-isolated trips (each user sees only their own data)
- AI trip generation with:
  - day-wise itinerary
  - route-aware transport options
  - hotel suggestions
  - local-currency budget estimates
  - destination-specific packing list
  - season tips for travel month
- Destination intelligence:
  - destination country auto-detection in trip form
  - auto-set Flight for international destinations (override supported)
  - destination highlights images (with fallback image source)
  - latest travel updates/news cards
- Editing:
  - regenerate a single day with feedback
  - add/remove activities
  - regenerate packing list
  - packing checklist toggle
- Trip management:
  - list/select/delete trips
  - custom delete confirmation modal
  - full-screen loader while generating itinerary
- Export:
  - polished HTML itinerary
  - polished PDF itinerary
  - aligned sections across HTML and PDF

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Auth | JWT, bcryptjs |
| AI | Google Gemini API |
| Export | jsPDF + HTML export |

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

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm
- MongoDB (local or Atlas)
- Gemini API key

## Environment Setup

### 1. Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/trao
JWT_SECRET=change-me
GEMINI_API_KEY=your-gemini-api-key
EXTERNAL_API_TIMEOUT_MS=90000
```

### 2. Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

> Do not commit `.env` or `.env.local`.

## Local Development

### 1. Install dependencies

```bash
cd backend
npm install
cd ../frontend
npm install
```

### 2. Run backend

```bash
cd backend
npm run dev
```

Backend: `http://localhost:5000`

### 3. Run frontend

```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:3000`

## Scripts

### Backend

- `npm run dev` - run with nodemon
- `npm start` - run with node

### Frontend

- `npm run dev` - start Next.js dev server on port 3000
- `npm run build` - production build
- `npm start` - run production server on port 3000
- `npm run clean` - remove `.next` cache/build folder

## API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Trips (protected)

- `GET /api/trips`
- `POST /api/trips`
- `POST /api/trips/detect-destination`
- `GET /api/trips/:id`
- `PUT /api/trips/:id`
- `DELETE /api/trips/:id`
- `POST /api/trips/:id/activities`
- `DELETE /api/trips/:id/activities`
- `POST /api/trips/:id/days/:dayNumber/regenerate`
- `POST /api/trips/:id/packing-list`

### Health

- `GET /health`

## Typical Flow

1. Register/login.
2. Create trip with destination, origin, transport, days, budget, interests.
3. Let AI generate itinerary + budget + hotels + packing + season tips.
4. Refine by regenerating days, editing activities, updating packing.
5. Download final itinerary as HTML or PDF.

## Notes

- Destination auto-detection can auto-select Flight for international trips.
- AI generation timeout can be tuned with `EXTERNAL_API_TIMEOUT_MS`.
- Older trips created before enrichment may have less media/news data than newly generated trips.
