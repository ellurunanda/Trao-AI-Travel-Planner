'use client';

import { apiFetch } from '@/utils/api';

export default function PackingList({ trip, onChange }) {
  const toggleItem = async (itemId) => {
    const packingList = trip.packingList.map((item) => (item._id === itemId ? { ...item, isPacked: !item.isPacked } : item));
    const response = await apiFetch(`/api/trips/${trip._id}`, {
      method: 'PUT',
      body: JSON.stringify({ packingList })
    });

    if (response.ok) {
      onChange(await response.json());
    }
  };

  const packed = trip.packingList.filter(i => i.isPacked).length;
  const total = trip.packingList.length;

  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">🎒 Packing List</h3>
          <p className="text-xs text-slate-400 mt-0.5">{packed} of {total} items packed</p>
        </div>
        <div className="h-2 w-32 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: total ? `${(packed/total)*100}%` : '0%' }} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {trip.packingList.map((item) => (
          <button
            key={item._id ?? item.item}
            onClick={() => item._id && toggleItem(item._id)}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${item.isPacked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition ${item.isPacked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
              {item.isPacked && '✓'}
            </span>
            <div className="min-w-0">
              <div className={`truncate text-sm font-medium ${item.isPacked ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.item}</div>
              <div className="text-xs text-slate-400">{item.category}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
