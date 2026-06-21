const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    estimatedCostUSD: { type: Number, default: 0 },
    estimatedCostLocal: { type: Number, default: 0 },
    timeOfDay: { type: String, enum: ['Morning', 'Afternoon', 'Evening'], default: 'Morning' }
  },
  { _id: true }
);

const TripSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    destination: { type: String, required: true },
    startingFrom: { type: String, default: '' },
    transportMode: { type: String, default: 'Flight' },
    transportOptions: [
      {
        mode: { type: String, default: '' },
        name: { type: String, default: '' },
        detail: { type: String, default: '' },
        estimatedCostLocal: { type: Number, default: 0 },
        bookingTip: { type: String, default: '' }
      }
    ],
    durationDays: { type: Number, required: true },
    budgetTier: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
    interests: [{ type: String }],
    currency: {
      code: { type: String, default: 'USD' },
      symbol: { type: String, default: '$' },
      name: { type: String, default: 'US Dollar' }
    },
    itinerary: [
      {
        dayNumber: { type: Number, required: true },
        activities: [ActivitySchema]
      }
    ],
    hotels: [
      {
        name: { type: String, required: true },
        tier: { type: String, default: '' },
        estimatedCostNightUSD: { type: Number, default: 0 },
        estimatedCostNightLocal: { type: Number, default: 0 },
        rating: { type: String, default: '' }
      }
    ],
    estimatedBudget: {
      transport: { type: Number, default: 0 },
      accommodation: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      activities: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    packingList: [
      {
        item: { type: String, required: true },
        category: { type: String, enum: ['Documents', 'Clothing', 'Gear', 'Other'], default: 'Other' },
        isPacked: { type: Boolean, default: false }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', TripSchema);
