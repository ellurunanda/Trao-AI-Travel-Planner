'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/utils/api';

export default function CreateTripForm({ onCreated, onGeneratingChange }) {
  const [destination, setDestination] = useState('');
  const [startingFrom, setStartingFrom] = useState('');
  const [transportMode, setTransportMode] = useState('Flight');
  const [autoFlight, setAutoFlight] = useState(false);
  const [durationDays, setDurationDays] = useState(5);
  const [budgetTier, setBudgetTier] = useState('Medium');
  const [interests, setInterests] = useState('food, sightseeing');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [detectingDestination, setDetectingDestination] = useState(false);
  const [destinationHint, setDestinationHint] = useState('');

  useEffect(() => {
    const query = destination.trim();
    if (query.length < 2) {
      setDetectingDestination(false);
      setDestinationHint('');
      setAutoFlight(false);
      return;
    }

    let cancelled = false;
    const timerId = setTimeout(async () => {
      setDetectingDestination(true);
      const response = await apiFetch('/api/trips/detect-destination', {
        method: 'POST',
        body: JSON.stringify({ destination: query })
      });

      if (cancelled) {
        return;
      }

      setDetectingDestination(false);
      if (!response.ok) {
        setDestinationHint('');
        setAutoFlight(false);
        return;
      }

      const data = await response.json();
      if (!data.detected) {
        setDestinationHint('Could not detect destination automatically.');
        setAutoFlight(false);
        return;
      }

      if (data.isInternational) {
        setTransportMode('Flight');
        setAutoFlight(true);
      } else {
        setAutoFlight(false);
      }

      setDestinationHint(data.countryName ? `Detected country: ${data.countryName}` : '');
    }, 550);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [destination]);

  const submit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    onGeneratingChange?.(true);
    setLoading(true);

    try {
      const response = await apiFetch('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          destination,
          startingFrom,
          transportMode,
          durationDays,
          budgetTier,
          interests: interests.split(',').map((item) => item.trim()).filter(Boolean)
        })
      });

      if (response.ok) {
        setDestination('');
        setStartingFrom('');
        setAutoFlight(false);
        setDestinationHint('');
        onCreated();
        return;
      }

      const error = await response.json().catch(() => ({}));
      setErrorMessage(error.message || 'Could not generate itinerary. Please try again.');
    } finally {
      setLoading(false);
      onGeneratingChange?.(false);
    }
  };

  return (
    <form onSubmit={submit} className="card relative space-y-4 p-5">
      <div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Create New Trip</h2>
        <p className="text-xs text-slate-400 mt-0.5">AI will generate a full itinerary.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Destination</label>
        <input className="field" placeholder="e.g. Tokyo, Paris, Bali" value={destination} onChange={(e) => setDestination(e.target.value)} required disabled={loading} />
        {detectingDestination && <p className="mt-1 text-xs text-slate-400">Detecting destination...</p>}
        {!detectingDestination && destinationHint && <p className="mt-1 text-xs text-slate-400">{destinationHint}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Starting From</label>
        <input className="field" placeholder="e.g. Mumbai, New York, London" value={startingFrom} onChange={(e) => setStartingFrom(e.target.value)} disabled={loading} />
      </div>
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Mode of Transport
          {autoFlight && (
            <span className="normal-case font-normal text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
              ✈ Auto-set: International destination
            </span>
          )}
        </label>
        <select
          className="field"
          value={transportMode}
          disabled={autoFlight || loading}
          onChange={(e) => setTransportMode(e.target.value)}
        >
          <option>Flight</option>
          <option>Train</option>
          <option>Bus</option>
          <option>Car</option>
          <option>Cruise</option>
          <option>Motorcycle</option>
          <option>Mixed</option>
        </select>
        {autoFlight && (
          <p className="mt-1 text-xs text-slate-400">Destination detected as international. You can <button type="button" className="text-indigo-500 underline" onClick={() => setAutoFlight(false)}>override</button>.</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Days</label>
          <input className="field" type="number" min={1} max={30} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} disabled={loading} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Budget</label>
          <select className="field" value={budgetTier} onChange={(e) => setBudgetTier(e.target.value)} disabled={loading}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Interests</label>
        <input className="field" placeholder="food, sightseeing, adventure..." value={interests} onChange={(e) => setInterests(e.target.value)} disabled={loading} />
      </div>
      <button disabled={loading} className="btn-primary w-full py-2.5">
        {loading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Generating with AI...
          </span>
        ) : '✨ Generate Itinerary'}
      </button>
      {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
    </form>
  );
}
