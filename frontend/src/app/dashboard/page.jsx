'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/utils/api';
import CreateTripForm from '@/components/CreateTripForm';
import ItineraryCard from '@/components/ItineraryCard';
import PackingList from '@/components/PackingList';

export default function DashboardPage() {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [pendingDeleteTripId, setPendingDeleteTripId] = useState(null);

  const loadTrips = async () => {
    const response = await apiFetch('/api/trips');
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    if (response.ok) {
      const data = await response.json();
      setTrips(data);
      setSelectedTrip((current) => current ?? data[0] ?? null);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login');
      return;
    }
    loadTrips();
  }, []);

  const refreshSelected = (trip) => {
    setTrips((current) => current.map((item) => (item._id === trip._id ? trip : item)));
    setSelectedTrip(trip);
  };

  const requestDeleteTrip = (tripId) => {
    setPendingDeleteTripId(tripId);
  };

  const cancelDeleteTrip = () => {
    setPendingDeleteTripId(null);
  };

  const deleteTrip = async () => {
    if (!pendingDeleteTripId) {
      return;
    }

    const tripId = pendingDeleteTripId;
    setDeletingTripId(tripId);

    const response = await apiFetch(`/api/trips/${tripId}`, { method: 'DELETE' });
    if (response.ok || response.status === 204) {
      setTrips((current) => {
        const remaining = current.filter((trip) => trip._id !== tripId);
        setSelectedTrip((currentSelected) => {
          if (currentSelected?._id !== tripId) {
            return currentSelected;
          }

          return remaining[0] ?? null;
        });
        return remaining;
      });
      setPendingDeleteTripId(null);
    } else {
      alert('Could not delete trip. Please try again.');
    }

    setDeletingTripId(null);
  };

  const pendingDeleteTrip = trips.find((trip) => trip._id === pendingDeleteTripId) ?? null;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-indigo-600">✈ Trao</span>
            <span className="hidden text-sm text-slate-400 sm:block">/ Dashboard</span>
          </div>
          <button
            className="btn-secondary text-sm"
            onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900">My Trips</h1>
          <p className="text-sm text-slate-500 mt-1">Build, edit, and track your AI itineraries.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Sidebar */}
          <div className="space-y-5">
            <CreateTripForm onCreated={loadTrips} />
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Your trips</h2>
                <span className="badge bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs">{trips.length}</span>
              </div>
              {trips.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No trips yet. Create one above!</p>
              ) : trips.map((trip) => (
                <div
                  key={trip._id}
                  className={`relative rounded-xl border p-4 transition ${selectedTrip?._id === trip._id ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                >
                  <button
                    onClick={() => setSelectedTrip(trip)}
                    className="w-full text-left pr-8"
                  >
                    <div className="font-semibold text-slate-900 truncate">📍 {trip.destination}</div>
                    {trip.startingFrom && <div className="text-xs text-slate-400 mt-0.5">From {trip.startingFrom}</div>}
                    <div className="mt-1 flex gap-2 flex-wrap">
                      <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{trip.durationDays} days</span>
                      <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{trip.budgetTier} budget</span>
                      {trip.transportMode && <span className="text-xs text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">🚀 {trip.transportMode}</span>}
                      {trip.currency?.code && trip.currency.code !== 'USD' && (
                        <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">{trip.currency.symbol} {trip.currency.code}</span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => requestDeleteTrip(trip._id)}
                    title="Delete trip"
                    disabled={deletingTripId === trip._id}
                    className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="space-y-5">
            {selectedTrip ? (
              <>
                <ItineraryCard
                  trip={selectedTrip}
                  onChange={refreshSelected}
                  onDelete={() => requestDeleteTrip(selectedTrip._id)}
                  isDeleting={deletingTripId === selectedTrip._id}
                />
                <PackingList trip={selectedTrip} onChange={refreshSelected} />
              </>
            ) : (
              <div className="card flex flex-col items-center justify-center py-20 text-center">
                <span className="text-5xl mb-4">🗺️</span>
                <p className="text-slate-700 font-semibold">No trip selected</p>
                <p className="text-sm text-slate-400 mt-1">Create a new trip or select one from the left panel.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingDeleteTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Delete trip?</h3>
            <p className="mt-2 text-sm text-slate-600">
              You are about to delete <span className="font-semibold">"{pendingDeleteTrip.destination}"</span>. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelDeleteTrip}
                disabled={deletingTripId === pendingDeleteTrip._id}
                className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteTrip}
                disabled={deletingTripId === pendingDeleteTrip._id}
                className="btn-primary bg-red-600 text-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingTripId === pendingDeleteTrip._id ? 'Deleting...' : 'Delete trip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
