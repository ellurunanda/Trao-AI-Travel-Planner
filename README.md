# Trao AI Travel Planner

## Project overview

Trao AI Travel Planner is a full-stack web app that helps users generate, customize, and export complete travel itineraries.  
Users can create trips with preferences (destination, budget, transport, interests), get AI-generated plans, edit activities, regenerate specific days, and export polished HTML/PDF travel documents.

## Chosen tech stack

| Layer | Technology | Why this choice |
|---|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS | Fast UI iteration, component reuse, responsive styling |
| Backend | Node.js, Express | Simple REST API development and middleware ecosystem |
| Database | MongoDB + Mongoose | Flexible schema for nested itinerary/activity structures |
| Auth | JWT + bcryptjs | Stateless auth with secure password hashing |
| AI | Google Gemini API | Structured itinerary generation using prompt-based JSON output |
| Export | jsPDF + HTML export | Easy shareability in both browser-friendly and printable formats |

## Setup instructions

### Local setup

1. **Prerequisites**
   - Node.js 18+ (LTS recommended)
   - npm
   - MongoDB (local or Atlas)
   - Gemini API key

2. **Backend environment**
   - Copy `backend/.env.example` to `backend/.env`
   - Configure:

   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/trao
   JWT_SECRET=change-me
   GEMINI_API_KEY=your-gemini-api-key
   EXTERNAL_API_TIMEOUT_MS=90000
   ```

3. **Frontend environment**
   - Create `frontend/.env.local`:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```

4. **Install and run**

   ```bash
   cd backend
   npm install
   npm run dev
   ```

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   - Frontend: `http://localhost:3000`
   - Backend: `http://localhost:5000`

### Deployed setup (recommended)

1. Deploy backend to a Node host (Render/Railway/Azure App Service).
2. Deploy frontend to Vercel (or any Next.js-compatible host).
3. Use MongoDB Atlas for production database.
4. Set backend env vars: `PORT`, `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `EXTERNAL_API_TIMEOUT_MS`.
5. Set frontend env var: `NEXT_PUBLIC_API_URL=<your-backend-url>`.
6. Ensure CORS in backend allows the deployed frontend origin.

## High-level architecture explanation

The application follows a client-server architecture:

1. **Frontend (Next.js)** renders forms, dashboard, itinerary cards, and export actions.
2. **Backend (Express)** exposes REST APIs for auth and trip operations.
3. **AI orchestration (controller layer)** builds prompts, calls Gemini, validates JSON response shape, enriches results (season/news/images), and persists to MongoDB.
4. **MongoDB** stores users and trip documents (itinerary, hotels, packing list, transport options, enrichments).

## Authentication and authorization approach

- **Authentication**: user registers/logs in via `/api/auth/register` and `/api/auth/login`.
- Passwords are hashed with `bcryptjs`.
- Successful login returns a signed JWT.
- **Authorization**: protected trip routes use auth middleware to validate JWT and attach `req.user`.
- All trip queries are filtered by `userId`, enforcing per-user data isolation.

## AI agent design and purpose

The AI layer is implemented in backend controllers as a focused orchestration pipeline (not a generic chat bot):

1. Build a strict prompt with trip constraints (duration, budget, transport mode, interests, current month).
2. Request structured JSON from Gemini.
3. Parse/normalize response and handle retries/timeouts.
4. Add enrichment data (destination images fallback, travel updates feed, season insights).
5. Save final trip model for UI editing/export.

Purpose: convert user travel intent into a practical, editable itinerary with realistic structure and costs.

## Creative/custom feature

**Destination intelligence enrichment** is the custom feature:

- Auto-detect destination country and auto-suggest Flight for international trips.
- Add destination highlight images (primary + fallback source).
- Show latest travel updates/news.
- Include season-aware tips for the current travel month.

This makes outputs more contextual than a plain static itinerary.

## Key design decisions and trade-offs

- **JSON-first AI output**: improved consistency for UI rendering, but requires strict prompting and parsing.
- **Stateless JWT auth**: scales well and keeps backend simple, but requires careful token handling in clients.
- **Flexible MongoDB schema**: fast iteration for nested trip data, but requires disciplined validation.
- **External enrichment sources**: improves experience, but introduces dependency on third-party availability and data quality.
- **Dual export (HTML + PDF)**: better user utility, but requires maintaining parity between two rendering paths.

## Known limitations

- AI output can still vary in quality based on model behavior and destination specificity.
- External image/news sources may occasionally return sparse or noisy results.
- Some older trips (created before enrichment fields were introduced) may show fewer enrichment sections.
- No offline mode; generation and enrichment require internet connectivity.

## API summary

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
