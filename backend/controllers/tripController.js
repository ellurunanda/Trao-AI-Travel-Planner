const Trip = require('../models/Trip');

const GATHERING_MESSAGE = 'The Gemini API key is missing or the service did not return a usable payload.';
const EXTERNAL_API_TIMEOUT_MS = Number(process.env.EXTERNAL_API_TIMEOUT_MS || 90000);
const VALID_TIME_OF_DAY = new Set(['Morning', 'Afternoon', 'Evening']);
const VALID_PACKING_CATEGORIES = new Set(['Documents', 'Clothing', 'Gear', 'Other']);

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

      let responseDetails = '';
      try {
        const errorPayload = await response.json();
        responseDetails = errorPayload?.error?.message || errorPayload?.message || JSON.stringify(errorPayload);
      } catch (jsonError) {
        try {
          responseDetails = await response.text();
        } catch (textError) {
          responseDetails = '';
        }
      }

      const canRetry = response.status === 429 || response.status >= 500;
      if (!canRetry || attempt === retries) {
        throw new Error(`External API Error: Status Code ${response.status}${responseDetails ? ` - ${responseDetails}` : ''}`);
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

function stripHtml(text = '') {
  return String(text).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function toText(value = '') {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decodeHtmlEntities(text = '') {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function fetchWikipediaImageFallback(destination) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const query = encodeURIComponent(destination);
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${query}&gsrnamespace=0&gsrlimit=6&prop=pageimages|info&piprop=thumbnail&pithumbsize=1200&inprop=url`;
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages || {});
    return pages
      .map((page) => {
        const imageUrl = page?.thumbnail?.source || '';
        if (!imageUrl) {
          return null;
        }
        return {
          url: imageUrl,
          title: page?.title || destination,
          source: 'Wikipedia'
        };
      })
      .filter(Boolean)
      .slice(0, 6);
  } catch (error) {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchDestinationImages(destination) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const query = encodeURIComponent(`${destination} landmark`);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&format=json`;
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages || {});
    return pages
      .map((page) => {
        const info = page?.imageinfo?.[0];
        const title = page?.title ? page.title.replace(/^File:/, '') : '';
        const imageUrl = info?.thumburl || info?.url || '';
        if (!imageUrl) {
          return null;
        }

        return { url: imageUrl, title, source: 'Wikimedia Commons' };
      })
      .filter(Boolean)
      .slice(0, 6);
  } catch (error) {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTravelUpdates(destination) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const query = encodeURIComponent(`${destination} travel tourism`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
    return items.map((match) => {
      const item = match[1] || '';
      const title = stripHtml(decodeHtmlEntities((item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''));
      const link = stripHtml((item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
      const pubDate = stripHtml((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '');
      const rawDescription = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
      const decodedDescription = decodeHtmlEntities(rawDescription);
      const cleanSummary = stripHtml(decodedDescription).replace(/Read more$/i, '').trim();
      const sourceLink = (decodedDescription.match(/href="([^"]+)"/i) || [])[1] || link;

      return {
        title,
        summary: cleanSummary.slice(0, 220),
        url: sourceLink,
        source: 'Google News',
        publishedAt: pubDate
      };
    }).filter((entry) => entry.title && entry.url);
  } catch (error) {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildPrompt({ destination, startingFrom, transportMode, durationDays, budgetTier, interests, feedback = '' }) {
  const origin = startingFrom ? `Starting from: ${startingFrom}.` : '';
  const transport = `Primary mode of transport: ${transportMode}.`;
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const regenerationFeedback = String(feedback || '').trim()
    ? `Regeneration feedback: ${String(feedback).trim()}.`
    : '';
  return `
Create a detailed ${durationDays}-day trip plan for ${destination}.
${origin}
${transport}
Budget tier: ${budgetTier}.
Interests: ${interests.join(', ') || 'general sightseeing'}.
Travel month: ${currentMonth}.
${regenerationFeedback}
 
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
- Add season-specific guidance for ${currentMonth}, including weather expectations, crowd level, and practical advice.

Return only JSON with this exact structure:
{
  "currency": { "code": "INR", "symbol": "₹", "name": "Indian Rupee" },
  "seasonTips": [
    {
      "title": "string (e.g. Weather Outlook)",
      "detail": "string"
    }
  ],
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

function buildRegenerateDayPrompt(trip, dayNumber, feedback = '') {
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const targetDay = (trip.itinerary || []).find((day) => day.dayNumber === Number(dayNumber));
  const itinerarySummary = (trip.itinerary || []).map((day) => ({
    dayNumber: day.dayNumber,
    activities: (day.activities || []).slice(0, 4).map((activity) => ({
      title: toText(activity.title),
      timeOfDay: toText(activity.timeOfDay)
    }))
  }));

  return `
Update only day ${Number(dayNumber)} for this trip.

Trip facts:
- Destination: ${trip.destination}
- Starting from: ${trip.startingFrom || 'not provided'}
- Duration: ${trip.durationDays} days
- Budget tier: ${trip.budgetTier}
- Transport mode: ${trip.transportMode || 'not specified'}
- Interests: ${(trip.interests || []).join(', ') || 'general sightseeing'}
- Travel month: ${currentMonth}
- Feedback: ${toText(feedback) || 'No additional feedback'}

Current day ${Number(dayNumber)} JSON:
${JSON.stringify(targetDay || { dayNumber: Number(dayNumber), activities: [] })}

Trip itinerary summary:
${JSON.stringify(itinerarySummary)}

Rules:
- Return only valid JSON
- Update only the requested day
- Keep activities realistic for the destination and budget
- Every activity MUST include a non-empty title
- Use only Morning, Afternoon, or Evening for timeOfDay
- Use estimatedCostLocal, not estimatedCostUSD

Return only this JSON shape:
{
  "dayNumber": ${Number(dayNumber)},
  "activities": [
    {
      "title": "string",
      "description": "string",
      "estimatedCostLocal": 0,
      "timeOfDay": "Morning|Afternoon|Evening"
    }
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

async function detectDestinationCountry(destination) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const encoded = encodeURIComponent(destination);
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encoded}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Trao-AI-Travel-Planner/1.0'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Geocoding Error: Status Code ${response.status}`);
    }

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const top = results[0];
    const countryCode = String(top?.address?.country_code || '').toUpperCase();
    const countryName = top?.address?.country || '';

    if (!countryCode) {
      return null;
    }

    return { countryCode, countryName };
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractRetryAfterSeconds(message = '') {
  const match = String(message).match(/Please retry in\s+([\d.]+)s/i);
  if (!match) {
    return null;
  }

  const seconds = Math.ceil(Number(match[1]));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function formatRetryDelay(seconds) {
  if (!seconds || seconds < 1) {
    return 'a moment';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function mapGenerationError(error) {
  if (error?.name === 'ValidationError') {
    return { status: 422, message: 'Generated trip data was incomplete. Please try again.' };
  }

  if (/timeout/i.test(error.message)) {
    return { status: 504, message: 'Trip generation timed out. Please try again.' };
  }

  if (/Status Code 400/i.test(error.message)) {
    return { status: 400, message: 'AI rejected the regenerate request. Try shorter feedback or try again.' };
  }

  if (/Status Code 401|Status Code 403/i.test(error.message)) {
    return { status: 502, message: 'Gemini API key is invalid or missing permission.' };
  }

  if (/Status Code 429/i.test(error.message)) {
    const retryAfterSeconds = extractRetryAfterSeconds(error.message);
    return {
      status: 429,
      message: `AI rate limit reached. Please wait ${formatRetryDelay(retryAfterSeconds)} and try again.`,
      retryAfterSeconds
    };
  }

  if (/External API Error/i.test(error.message)) {
    return { status: 502, message: 'AI service is temporarily unavailable. Please try again.' };
  }

  return { status: 500, message: 'Failed to generate trip details. Please try again.' };
}

function sendGenerationFailure(res, error) {
  const failure = mapGenerationError(error);
  const body = { message: failure.message };

  if (failure.retryAfterSeconds) {
    body.retryAfterSeconds = failure.retryAfterSeconds;
  }

  return res.status(failure.status).json(body);
}

function buildTripInput(source = {}) {
  return {
    destination: source.destination,
    startingFrom: source.startingFrom || '',
    transportMode: source.transportMode || 'Flight',
    durationDays: source.durationDays,
    budgetTier: source.budgetTier,
    interests: Array.isArray(source.interests) ? source.interests : []
  };
}

function normalizeActivity(activity = {}, index = 0) {
  const description = toText(activity.description);
  const fallbackTitle = description ? description.split(/[.!?]/)[0].trim().slice(0, 80) : '';
  const title = toText(activity.title) || toText(activity.name) || fallbackTitle || `Activity ${index + 1}`;
  const timeOfDay = VALID_TIME_OF_DAY.has(activity.timeOfDay) ? activity.timeOfDay : 'Afternoon';

  return {
    title,
    description,
    estimatedCostUSD: toNumber(activity.estimatedCostUSD, 0),
    estimatedCostLocal: toNumber(activity.estimatedCostLocal ?? activity.estimatedCostUSD, 0),
    timeOfDay
  };
}

function normalizeItinerary(itinerary = [], durationDays = 0) {
  const normalized = Array.isArray(itinerary)
    ? itinerary.map((day, index) => ({
        dayNumber: toNumber(day?.dayNumber, index + 1),
        activities: Array.isArray(day?.activities)
          ? day.activities.map((activity, activityIndex) => normalizeActivity(activity, activityIndex))
          : []
      }))
    : [];

  if (normalized.length > 0) {
    return normalized;
  }

  return Array.from({ length: Math.max(toNumber(durationDays, 0), 0) }, (_, index) => ({
    dayNumber: index + 1,
    activities: []
  }));
}

function normalizeTransportOptions(options = []) {
  return Array.isArray(options)
    ? options.map((option) => ({
        mode: toText(option.mode),
        name: toText(option.name),
        detail: toText(option.detail),
        estimatedCostLocal: toNumber(option.estimatedCostLocal, 0),
        bookingTip: toText(option.bookingTip)
      }))
    : [];
}

function normalizeHotels(hotels = [], budgetTier = '') {
  return Array.isArray(hotels)
    ? hotels.map((hotel, index) => ({
        name: toText(hotel.name) || `Recommended Hotel ${index + 1}`,
        tier: toText(hotel.tier) || toText(budgetTier),
        estimatedCostNightUSD: toNumber(hotel.estimatedCostNightUSD, 0),
        estimatedCostNightLocal: toNumber(hotel.estimatedCostNightLocal ?? hotel.estimatedCostNightUSD, 0),
        rating: toText(hotel.rating)
      }))
    : [];
}

function normalizePackingList(packingList = []) {
  return Array.isArray(packingList)
    ? packingList
        .map((item) => {
          const label = toText(item?.item);
          if (!label) {
            return null;
          }

          const category = VALID_PACKING_CATEGORIES.has(item.category) ? item.category : 'Other';
          return {
            item: label,
            category,
            isPacked: Boolean(item.isPacked)
          };
        })
        .filter(Boolean)
    : [];
}

function normalizeSeasonTips(seasonTips = []) {
  return Array.isArray(seasonTips)
    ? seasonTips.map((tip) => ({
        title: toText(tip?.title),
        detail: toText(tip?.detail)
      }))
    : [];
}

function normalizeTravelUpdates(travelUpdates = []) {
  return Array.isArray(travelUpdates)
    ? travelUpdates.map((update) => ({
        title: toText(update?.title),
        summary: toText(update?.summary),
        url: toText(update?.url),
        source: toText(update?.source),
        publishedAt: toText(update?.publishedAt)
      }))
    : [];
}

function normalizeDestinationImages(images = [], destination = '') {
  return Array.isArray(images)
    ? images
        .map((image) => {
          const url = toText(image?.url);
          if (!url) {
            return null;
          }

          return {
            url,
            title: toText(image?.title) || destination,
            source: toText(image?.source)
          };
        })
        .filter(Boolean)
    : [];
}

function normalizeEstimatedBudget(estimatedBudget = {}) {
  return {
    transport: toNumber(estimatedBudget.transport, 0),
    accommodation: toNumber(estimatedBudget.accommodation, 0),
    food: toNumber(estimatedBudget.food, 0),
    activities: toNumber(estimatedBudget.activities, 0),
    total: toNumber(estimatedBudget.total, 0)
  };
}

function buildTripData(generated, tripInput, enrichment = {}) {
  return {
    destination: tripInput.destination,
    startingFrom: tripInput.startingFrom,
    transportMode: tripInput.transportMode,
    durationDays: tripInput.durationDays,
    budgetTier: tripInput.budgetTier,
    interests: tripInput.interests,
    currency: generated.currency || { code: 'USD', symbol: '$', name: 'US Dollar' },
    destinationImages: normalizeDestinationImages(enrichment.destinationImages, tripInput.destination),
    travelUpdates: normalizeTravelUpdates(enrichment.travelUpdates),
    seasonTips: normalizeSeasonTips(generated.seasonTips || enrichment.seasonTips || []),
    transportOptions: normalizeTransportOptions(generated.transportOptions),
    itinerary: normalizeItinerary(generated.itinerary, tripInput.durationDays),
    hotels: normalizeHotels(generated.hotels, tripInput.budgetTier),
    estimatedBudget: normalizeEstimatedBudget(generated.estimatedBudget),
    packingList: normalizePackingList(generated.packingList)
  };
}

async function generateTripContent(tripInput, feedback = '') {
  const [generated, primaryImages, fallbackImages, travelUpdates] = await Promise.all([
    generateFromGemini(buildPrompt({ ...tripInput, feedback })),
    fetchDestinationImages(tripInput.destination),
    fetchWikipediaImageFallback(tripInput.destination),
    fetchTravelUpdates(tripInput.destination)
  ]);
  const destinationImages = primaryImages.length ? primaryImages : fallbackImages;

  return {
    generated,
    enrichment: { destinationImages, travelUpdates }
  };
}

async function saveTrip(req, res, generated, tripInput, enrichment = {}) {
  const trip = await Trip.create({
    userId: req.user.id,
    ...buildTripData(generated, tripInput, enrichment)
  });

  return res.status(201).json(trip);
}

exports.getTrips = async (req, res) => {
  const trips = await Trip.find({ userId: req.user.id }).sort({ createdAt: -1 });
  return res.json(trips);
};

exports.generateNewTrip = async (req, res) => {
  const tripInput = buildTripInput(req.body);
  const { destination, durationDays, budgetTier } = tripInput;

  if (!destination || !durationDays || !budgetTier) {
    return res.status(400).json({ message: 'destination, durationDays, and budgetTier are required' });
  }

  try {
    const { generated, enrichment } = await generateTripContent(tripInput);
    return saveTrip(req, res, generated, tripInput, enrichment);
  } catch (error) {
    return sendGenerationFailure(res, error);
  }
};

exports.detectDestination = async (req, res) => {
  const destination = String(req.body?.destination || '').trim();
  if (destination.length < 2) {
    return res.status(400).json({ message: 'Destination is required' });
  }

  try {
    const detected = await detectDestinationCountry(destination);
    if (!detected) {
      return res.json({ detected: false, isInternational: false });
    }

    return res.json({
      detected: true,
      isInternational: detected.countryCode !== 'IN',
      countryCode: detected.countryCode,
      countryName: detected.countryName
    });
  } catch (error) {
    return res.status(502).json({ message: 'Could not auto-detect destination right now.' });
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
  const updates = {};

  if (req.body.itinerary !== undefined) {
    updates.itinerary = normalizeItinerary(req.body.itinerary);
  }
  if (req.body.packingList !== undefined) {
    updates.packingList = normalizePackingList(req.body.packingList);
  }
  if (req.body.estimatedBudget !== undefined) {
    updates.estimatedBudget = normalizeEstimatedBudget(req.body.estimatedBudget);
  }
  if (req.body.hotels !== undefined) {
    updates.hotels = normalizeHotels(req.body.hotels);
  }

  const trip = await Trip.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!trip) {
    return res.status(404).json({ message: 'Trip not found' });
  }

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
  const normalizedActivity = normalizeActivity(activity);

  const trip = await Trip.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, 'itinerary.dayNumber': Number(dayNumber) },
    { $push: { 'itinerary.$.activities': normalizedActivity } },
    { new: true, runValidators: true }
  );

  if (!trip) {
    return res.status(404).json({ message: 'Trip or day not found' });
  }

  return res.json(trip);
};

exports.removeActivity = async (req, res) => {
  const { dayNumber, activityId } = req.body;
  const trip = await Trip.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id, 'itinerary.dayNumber': Number(dayNumber) },
    { $pull: { 'itinerary.$.activities': { _id: activityId } } },
    { new: true, runValidators: true }
  );

  if (!trip) {
    return res.status(404).json({ message: 'Trip or day not found' });
  }

  return res.json(trip);
};

exports.regenerateDay = async (req, res) => {
  const { feedback } = req.body;
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  let generated;
  try {
    generated = await generateFromGemini(buildRegenerateDayPrompt(trip, req.params.dayNumber, feedback));
  } catch (error) {
    console.error('regenerateDay Gemini error:', error.message);
    return sendGenerationFailure(res, error);
  }
  const newDay = generated.dayNumber ? generated : generated.itinerary?.[0];
  if (!newDay) {
    return res.status(500).json({ message: 'Could not regenerate day' });
  }

  const normalizedDay = {
    dayNumber: Number(req.params.dayNumber),
    activities: normalizeItinerary([newDay], 1)[0]?.activities || []
  };
  const itinerary = trip.itinerary.map((day) => (day.dayNumber === Number(req.params.dayNumber) ? normalizedDay : day));
  const updatedTrip = await Trip.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { itinerary } },
    { new: true, runValidators: true }
  );

  if (!updatedTrip) {
    return res.status(404).json({ message: 'Trip not found' });
  }

  return res.json(updatedTrip);
};

exports.regenerateTrip = async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  const feedback = String(req.body?.feedback || '').trim();
  const tripInput = buildTripInput(trip.toObject());

  try {
    const { generated, enrichment } = await generateTripContent(tripInput, feedback);
    const updatedTrip = await Trip.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: buildTripData(generated, tripInput, enrichment) },
      { new: true, runValidators: true }
    );

    if (!updatedTrip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    return res.json(updatedTrip);
  } catch (error) {
    console.error('regenerateTrip Gemini error:', error.message);
    return sendGenerationFailure(res, error);
  }
};

exports.generatePackingList = async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.id });
  if (!trip) return res.status(404).json({ message: 'Trip not found' });

  let generated;
  try {
    generated = await generateFromGemini(buildPackingPrompt(trip));
  } catch (error) {
    return sendGenerationFailure(res, error);
  }

  const updatedTrip = await Trip.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { packingList: normalizePackingList(generated.packingList) } },
    { new: true, runValidators: true }
  );

  if (!updatedTrip) {
    return res.status(404).json({ message: 'Trip not found' });
  }

  return res.json(updatedTrip);
};
