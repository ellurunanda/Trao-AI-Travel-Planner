# TRAO AI Travel Planner — Project Documentation

---

## TABLE OF CONTENTS

1. Project Overview  
2. Technology Stack  
3. System Architecture  
4. Backend Structure  
5. Frontend Structure  
6. Database Models  
7. API Routes & Endpoints  
8. Authentication & Security  
9. Background Scheduler Jobs  
10. Third-Party Integrations  
11. Email Notification System  
12. Frontend Pages & Features  
13. State Management  
14. Environment Configuration  
15. Deployment Notes

---

## 1. PROJECT OVERVIEW

**Project Name:** TRAO AI Travel Planner  
**Version:** 1.0.0  
**Description:** Full-stack AI-powered trip planning app for generating, customizing, and exporting travel itineraries.

**Purpose:**  
TRAO helps users:
- Register/login and manage personal travel plans
- Generate destination-specific itineraries using Gemini AI
- Auto-detect destination country and suggest transport behavior
- Regenerate specific itinerary days using user feedback
- Manage destination-aware packing lists
- Export trips as styled HTML and PDF
- Track trip enrichments like destination images, season tips, and travel updates

---

## 2. TECHNOLOGY STACK

### Backend

| Component | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 4 |
| Database ODM | Mongoose 8 |
| Database | MongoDB |
| Authentication | JWT (`jsonwebtoken`) |
| Password Hashing | `bcryptjs` |
| Config | `dotenv` |
| Dev Server | `nodemon` |
| External AI | Google Gemini (`gemini-2.5-flash`) |

### Frontend

| Component | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI Library | React 19 |
| Styling | Tailwind CSS |
| HTTP Client | Fetch API (custom wrapper) |
| PDF Export | `jspdf` |
| Build Tooling | Next.js + PostCSS + Autoprefixer |
| Default Dev Port | 3000 |

---

## 3. SYSTEM ARCHITECTURE

### High-Level Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                       │
│   App Router | Tailwind UI | Local State | API wrapper      │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTP/REST + Bearer JWT
┌───────────────────────────▼──────────────────────────────────┐
│                    BACKEND (Express)                         │
│  Routes → Controllers → Mongoose Models                      │
│  AI orchestration + enrichment APIs + auth middleware        │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                     MongoDB (trao DB)                        │
│              Collections: users, trips                       │
└───────────────────────────────────────────────────────────────┘
```

### Request Flow

```text
UI action → /api/* endpoint → auth middleware (protected routes)
→ controller logic (AI/enrichment/CRUD) → MongoDB → JSON response
```

### CORS

**CORS is enabled** in the backend.

- Implementation: `app.use(cors())` in `backend/server.js`
- Current behavior: open/default CORS policy
- Note: there is **no explicit origin allowlist** configured right now

---

## 4. BACKEND STRUCTURE

```text
backend/
├── server.js
├── .env / .env.example
├── config/
│   └── db.js
├── middleware/
│   └── auth.js
├── models/
│   ├── User.js
│   └── Trip.js
├── controllers/
│   ├── authController.js
│   └── tripController.js
├── routes/
│   ├── authRoutes.js
│   └── tripRoutes.js
└── package.json
```

### Application Startup (`server.js`)
1. Loads env vars with `dotenv`.
2. Initializes Express + JSON body parser.
3. Registers routes:
   - `/api/auth`
   - `/api/trips`
4. Enables CORS globally with `app.use(cors())`.
5. Exposes `/health`.
6. Connects to MongoDB using `MONGO_URI`.
7. Starts server on `PORT` (default 5000).

---

## 5. FRONTEND STRUCTURE

```text
frontend/
├── src/
│   ├── app/
│   │   ├── layout.jsx
│   │   ├── page.jsx               # landing
│   │   ├── login/page.jsx
│   │   ├── register/page.jsx
│   │   └── dashboard/page.jsx
│   ├── components/
│   │   ├── CreateTripForm.jsx
│   │   ├── ItineraryCard.jsx
│   │   └── PackingList.jsx
│   └── utils/
│       └── api.js
├── next.config.js
├── tailwind.config.js
└── package.json
```

### Routing (App Router)
| Path | Page |
|---|---|
| `/` | Landing page |
| `/login` | Login |
| `/register` | Register |
| `/dashboard` | Authenticated user trip workspace |

---

## 6. DATABASE MODELS

### Users Collection (`users`)
| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `name` | String | Full name |
| `email` | String (unique, lowercase) | Login identifier |
| `password` | String | Bcrypt hash |
| `createdAt` | Date | Auto timestamp |
| `updatedAt` | Date | Auto timestamp |

### Trips Collection (`trips`)
| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `userId` | ObjectId (ref User) | Owner of trip |
| `destination` | String | Trip destination |
| `startingFrom` | String | Origin city/location |
| `transportMode` | String | Flight/Train/Bus/Car/Cruise/Motorcycle/Mixed |
| `durationDays` | Number | Trip duration |
| `budgetTier` | Enum | Low/Medium/High |
| `interests` | String[] | User interests |
| `currency` | Object | `{ code, symbol, name }` |
| `destinationImages` | Array | Destination image metadata |
| `seasonTips` | Array | Seasonal recommendations |
| `travelUpdates` | Array | News/update entries |
| `transportOptions` | Array | Route/option suggestions |
| `itinerary` | Array | Day-wise activity blocks |
| `hotels` | Array | Recommended hotels |
| `estimatedBudget` | Object | Transport/accommodation/food/activities/total |
| `packingList` | Array | Checklist items with packed state |
| `createdAt` | Date | Auto timestamp |
| `updatedAt` | Date | Auto timestamp |

### Embedded Subdocuments
- `ActivitySchema` inside itinerary days
- Packing list item schema (`item`, `category`, `isPacked`)
- Hotel, transport option, image, travel update, and season tip subdocs

---

## 7. API ROUTES & ENDPOINTS

### Auth (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user and return JWT |
| POST | `/api/auth/login` | Login and return JWT |

### Trips (`/api/trips`) — Protected (Bearer token required)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/trips` | List current user trips |
| POST | `/api/trips` | Generate and save new AI trip |
| POST | `/api/trips/detect-destination` | Detect destination country and international flag |
| GET | `/api/trips/:id` | Fetch one trip (owner only) |
| PUT | `/api/trips/:id` | Update itinerary/packing/budget/hotels |
| DELETE | `/api/trips/:id` | Delete trip |
| POST | `/api/trips/:id/activities` | Add activity to a day |
| DELETE | `/api/trips/:id/activities` | Remove activity from a day |
| POST | `/api/trips/:id/regenerate` | Regenerate the full trip via AI |
| POST | `/api/trips/:id/days/:dayNumber/regenerate` | Regenerate specific day via AI |
| POST | `/api/trips/:id/packing-list` | Regenerate packing list via AI |

### System
| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Service health check |

---

## 8. AUTHENTICATION & SECURITY

### Authentication Flow
1. User registers or logs in.
2. Password hashed/verified with bcrypt.
3. JWT issued with user payload (`id`, `email`, `name`) and `7d` expiry.
4. Frontend stores token in `localStorage`.
5. Protected API calls include `Authorization: Bearer <token>`.

### Authorization
- `middleware/auth.js` validates bearer token and rejects malformed/expired tokens.
- All trip queries are filtered by `userId` to enforce per-user data isolation.

### Security Notes
- Requires `JWT_SECRET` in backend env.
- Backend generic error handler returns 500 for unhandled failures.
- Trip generation APIs use retries/timeouts for external AI robustness.

---

## 9. BACKGROUND SCHEDULER JOBS

No APScheduler/cron/background scheduler is implemented in the current TRAO backend.

---

## 10. THIRD-PARTY INTEGRATIONS

| Integration | Purpose |
|---|---|
| Google Gemini API | AI itinerary and packing-list generation |
| OpenStreetMap Nominatim | Destination country detection |
| Wikimedia Commons API | Destination image retrieval |
| Wikipedia API | Fallback destination images |
| Google News RSS | Travel updates/news enrichment |

---

## 11. EMAIL NOTIFICATION SYSTEM

No SMTP/SES/email notification subsystem is implemented in the current TRAO codebase.

---

## 12. FRONTEND PAGES & FEATURES

### Landing (`/`)
- Marketing hero and feature overview
- Quick links to register/login

### Register (`/register`)
- Name/email/password signup
- Auto-login behavior after successful registration

### Login (`/login`)
- Email/password login
- Token storage in localStorage
- Redirect to dashboard

### Dashboard (`/dashboard`)
- Trip list sidebar with selection and deletion
- New trip generation form
- Full-trip regeneration using optional feedback
- Itinerary editor and day regeneration
- Add/remove activities per day
- Packing list progress and toggle states
- Destination highlights, season tips, travel updates, transport options
- Export itinerary as HTML and PDF
- Sign-out flow

---

## 13. STATE MANAGEMENT

TRAO currently uses **component-local React state** (`useState`, `useEffect`) and browser storage (`localStorage` for JWT).  
There is **no Redux/Redux Toolkit** in this project.

---

## 14. ENVIRONMENT CONFIGURATION

### Backend (`backend/.env`)
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/trao
JWT_SECRET=change-me
GEMINI_API_KEY=your-gemini-api-key
EXTERNAL_API_TIMEOUT_MS=90000
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## 15. DEPLOYMENT NOTES

### Recommended Deployment Pattern
1. Deploy backend (Express) on Render/Railway/Azure App Service (or similar).
2. Deploy frontend (Next.js) on Vercel (or Next-compatible host).
3. Use MongoDB Atlas in production.
4. Set backend env vars: `PORT`, `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `EXTERNAL_API_TIMEOUT_MS`.
5. Set frontend env var: `NEXT_PUBLIC_API_URL=<backend-url>`.
6. Restrict backend CORS to production frontend origin before go-live.
