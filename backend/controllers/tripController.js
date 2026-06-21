const Trip = require('../models/Trip');

const GATHERING_MESSAGE = 'The Gemini API key is missing or the service did not return a usable payload.';
const EXTERNAL_API_TIMEOUT_MS = Number(process.env.EXTERNAL_API_TIMEOUT_MS || 90000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
  let attempt = 0;
  let currentDelay = delay;
  let lastError = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_API_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        return response.json();
      }

      const canRetry = response.status === 429 || response.status >= 500;
      if (!canRetry || attempt === retries) {
        throw new Error(`External API Error: Status Code ${response.status}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const isTimeout = error && (error.name === 'AbortError' || /abort|timeout/i.test(error.message));

      if (isTimeout && attempt === retries) {
        throw new Error('External API timeout while generating itinerary');
      }

      if (!isTimeout && attempt === retries) {
        throw error;
      }

      lastError = error;
    }

    await sleep(currentDelay);
    currentDelay *= 2;
    attempt += 1;
  }

  throw lastError || new Error('External API request failed');
}

function normalizeGeminiText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(GATHERING_MESSAGE);
  }

  const trimmed = text.trim();
  return JSON.parse(trimmed);
}

function buildPrompt({ destination, startingFrom, transportMode, durationDays, budgetTier, interests }) {
  const origin = startingFrom ? `Starting from: ${startingFrom}.` : '';
  const transport = `Primary mode of transport: ${transportMode}.`;
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  return `
Create a detailed ${durationDays}-day trip plan for ${destination}.
${origin}
${transport}
Budget tier: ${budgetTier}.
Interests: ${interests.join(', ') || 'general sightseeing'}.
Travel month: ${currentMonth}.

IMPORTANT:
- Detect the local currency for ${destination} and use it for ALL cost estimates.
- Include travel/transit details on Day 1 based on the starting location and transport mode.
- Based on the mode "${transportMode}", suggest 2-4 REAL, specific transport options available for this route. Examples:
  * Flight: real airlines operating on this route (e.g. IndiGo 6E-234, Air India AI-101)
  * Train: real train names/numbers (e.g. Rajdhani Express 12951, Shinkansen N700)
  * Bus: real bus operators/services (e.g. RedBus Volvo, KSRTC Express)
  * Car: route options with highway names and drive duration
  * Cruise: cruise lines/ships operating in this region
  * Motorcycle: recommended route with road type and distance
- Packing list must be destination-aware for ${destination}, not a generic template.
- Include destination-specific essentials based on climate, local customs, terrain, and planned activities.
- Include at least 5 destination-specific items and at least 2 weather-specific clothing items.

Return only JSON with this exact structure:
{
  "currency": { "code": "INR", "symbol": "₹", "name": "Indian Rupee" },
  "transportOptions": [
    {
      "mode": "${transportMode}",
      "name": "string (e.g. Rajdhani Express 12951 / IndiGo 6E-101)",
      "detail": "string (e.g. Departs 06:00, arrives 14:30 / Duration 8h 30m)",
      "estimatedCostLocal": 0,
      "bookingTip": "string (e.g. Book via IRCTC / MakeMyTrip)"
    }
  ],
  "itinerary": [
    {
      "dayNumber": 1,
      "activities": [
        {
          "title": "string",
          "description": "string",
          "estimatedCostLocal": 0,
          "timeOfDay": "Morning|Afternoon|Evening"
        }
      ]
    }
  ],
  "hotels": [
    {
      "name": "string",
      "tier": "string",
      "estimatedCostNightLocal": 0,
      "rating": "string"
    }
  ],
  "estimatedBudget": {
    "transport": 0,
    "accommodation": 0,
    "food": 0,
    "activities": 0,
    "total": 0
  },
  "packingList": [
    {
      "item": "string",
      "category": "Documents|Clothing|Gear|Other",
      "isPacked": false
    }
  ]
}
Keep all estimates realistic in local currency for the specified budget tier.
  `.trim();
}

function buildPackingPrompt(trip) {
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const interests = (trip.interests || []).join(', ') || 'general sightseeing';

  return `
Create a destination-specific packing checklist for a trip to ${trip.destination}.
Trip facts:
- Starting from: ${trip.startingFrom || 'not provided'}
- Transport mode: ${trip.transportMode || 'not specified'}
- Duration: ${trip.durationDays} days
- Budget tier: ${trip.budgetTier}
- Interests: ${interests}
- Travel month: ${currentMonth}
- Itinerary JSON: ${JSON.stringify(trip.itinerary)}

Rules:
- Do NOT return the same generic list used for every destination.
- Tailor items to destination climate, local etiquette/cultural norms, terrain, and itinerary activities.
- Include at least 5 destination-specific items and at least 2 weather-specific clothing items.
- Keep categories limited to Documents, Clothing, Gear, Other.
- Avoid duplicates.

Return only JSON:
{
  "packingList": [
    { "item": "Passport", "category": "Documents", "isPacked": false }
  ]
}
  `.trim();
}

async function generateFromGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(GATHERING_MESSAGE);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const data = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return normalizeGeminiText(data);
}

function mapGenerationError(error) {
  if (/timeout/i.test(error.message)) {
    return { status: 504, message: 'Trip generation timed out. Please try again.' };
  }

  if (/External API Error/i.test(error.message)) {
    return { status: 502, message: 'AI service is temporarily unavailable. Please try again.' };
  }

  return { status: 500, message: 'Failed to generate trip details. Please try again.' };
}

async function saveTrip(req, res, generated, tripInput) {
  const trip = await Trip.create({
    userId: req.user.id,
    destination: tripInput.destination,
    durationDays: tripInput.durationDays,
    budgetTier: tripInput.budgetTier,
    interests: tripInput.interests,
    currency: generated.currency || { code: 'USD', symbol: '$', name: 'US Dollar' },
    startingFrom: tripInput.startingFrom,
    transportMode: tripInput.transportMode,
    transportOptions: generated.transportOptions || [],
    itinerary: generated.itinerary || [],
    hotels: generated.hotels || [],
    estimatedBudget: generated.estimatedBudget || {},
    packingList: generated.packingList || []
  });

  return res.status(201).json(trip);
}

exports.getTrips = async (req, res) => {
  const trips = await Trip.find({ userId: req.user.id }).sort({ createdAt: -1 });
  return res.json(trips);
};

exports.generateNewTrip = async (req, res) => {
  const { destination, startingFrom = '', transportMode = 'Flight', durationDays, budgetTier, interests = [] } = req.body;

  if (!destination || !durationDays || !budgetTier) {
    return res.status(400).json({ message: 'destination, durationDays, and budgetTier are required' });
  }

  try {
    const generated = await generateFromGemini(buildPrompt({ destination, startingFrom, transportMode, durationDays, budgetTier, interests }));
    return saveTrip(req, res, generated, { destination, startingFrom, transportMode, durationDays, budgetTier, interests });
  } catch (error) {
    const failure = mapGenerationError(error);
    return res.status(failure.status).json({ message: failure.message });
  }
};

exports.getTripById = async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) {
    return res.status(404).json({ message: 'Trip not found' });
  }
  return res.json(trip);
};

exports.updateTrip = async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) {
    return res.status(404).json({ message: 'Trip not found' });
  }

  const allowed = ['itinerary', 'packingList', 'estimatedBudget', 'hotels'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      trip[key] = req.body[key];
    }
  }

  await trip.save();
  return res.json(trip);
};

exports.deleteTrip = async (req, res) => {
  const deleted = await Trip.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!deleted) {
    return res.status(404).json({ message: 'Trip not found' });
  }
  return res.status(204).send();
};

exports.addActivity = async (req, res) => {
  const { dayNumber, activity } = req.body;
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const day = trip.itinerary.find((entry) => entry.dayNumber === Number(dayNumber));
  if (!day) return res.status(404).json({ message: 'Day not found' });

  day.activities.push(activity);
  await trip.save();
  return res.json(trip);
};

exports.removeActivity = async (req, res) => {
  const { dayNumber, activityId } = req.body;
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const day = trip.itinerary.find((entry) => entry.dayNumber === Number(dayNumber));
  if (!day) return res.status(404).json({ message: 'Day not found' });

  day.activities = day.activities.filter((activity) => activity._id.toString() !== activityId);
  await trip.save();
  return res.json(trip);
};

exports.regenerateDay = async (req, res) => {
  const { feedback } = req.body;
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const prompt = `
Update only day ${req.params.dayNumber} for this trip:
Destination: ${trip.destination}
Duration: ${trip.durationDays}
Budget tier: ${trip.budgetTier}
Current trip JSON: ${JSON.stringify(trip.itinerary)}
Feedback: ${feedback}

Return only JSON for a single day object:
{
  "dayNumber": ${Number(req.params.dayNumber)},
  "activities": [{ "title": "", "description": "", "estimatedCostUSD": 0, "timeOfDay": "Morning" }]
}
  `.trim();

  let generated;
  try {
    generated = await generateFromGemini(prompt);
  } catch (error) {
    const failure = mapGenerationError(error);
    return res.status(failure.status).json({ message: failure.message });
  }
  const newDay = generated.dayNumber ? generated : generated.itinerary?.[0];
  if (!newDay) {
    return res.status(500).json({ message: 'Could not regenerate day' });
  }

  trip.itinerary = trip.itinerary.map((day) => (day.dayNumber === Number(req.params.dayNumber) ? newDay : day));
  await trip.save();
  return res.json(trip);
};

exports.generatePackingList = async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  let generated;
  try {
    generated = await generateFromGemini(buildPackingPrompt(trip));
  } catch (error) {
    const failure = mapGenerationError(error);
    return res.status(failure.status).json({ message: failure.message });
  }
  trip.packingList = generated.packingList || [];
  await trip.save();
  return res.json(trip);
};
