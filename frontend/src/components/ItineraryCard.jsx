'use client';

import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { apiFetch } from '@/utils/api';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function ItineraryCard({ trip, onChange, onDelete, isDeleting = false }) {
  const [feedback, setFeedback] = useState('');
  const [drafts, setDrafts] = useState({});

  const sym = trip.currency?.symbol || '$';
  const code = trip.currency?.code || 'USD';
  const currencyLabel = `${sym}${code ? ` ${code}` : ''}`;
  const formatMoney = (value, suffix = '') => (value > 0 ? `${sym}${Number(value).toLocaleString()}${suffix}` : '');

  const downloadHtml = () => {
    const transportRows = (trip.transportOptions || []).map((option) => `
      <article class="card transport-card">
        <div class="card-title">${escapeHtml(option.name || trip.transportMode || 'Transport')}</div>
        <p class="subtle">${escapeHtml(option.detail || '')}</p>
        ${option.estimatedCostLocal > 0 ? `<div class="price">${escapeHtml(formatMoney(option.estimatedCostLocal, ' / person'))}</div>` : ''}
        ${option.bookingTip ? `<p class="tip"><strong>Tip:</strong> ${escapeHtml(option.bookingTip)}</p>` : ''}
      </article>
    `).join('');

    const itineraryRows = (trip.itinerary || []).map((day) => `
      <section class="day-card">
        <div class="day-header">Day ${day.dayNumber}</div>
        <div class="timeline">
          ${(day.activities || []).map((activity) => `
            <article class="activity">
              <div class="activity-title-row">
                <div class="activity-title">${escapeHtml(activity.title)}</div>
                <div class="pill">${escapeHtml(activity.timeOfDay || 'Anytime')}</div>
              </div>
              <p class="subtle">${escapeHtml(activity.description || '')}</p>
              ${activity.estimatedCostLocal > 0 ? `<div class="price">${escapeHtml(formatMoney(activity.estimatedCostLocal))}</div>` : ''}
            </article>
          `).join('')}
        </div>
      </section>
    `).join('');

    const hotelRows = (trip.hotels || []).map((hotel) => `
      <article class="card">
        <div class="card-title">${escapeHtml(hotel.name)}</div>
        <p class="subtle">${escapeHtml(hotel.tier || 'Standard')}</p>
        <div class="meta-row">
          ${hotel.estimatedCostNightLocal > 0 ? `<span>${escapeHtml(formatMoney(hotel.estimatedCostNightLocal, ' / night'))}</span>` : '<span>Rate on request</span>'}
          ${hotel.rating ? `<span>⭐ ${escapeHtml(hotel.rating)}</span>` : ''}
        </div>
      </article>
    `).join('');

    const packingRows = (trip.packingList || []).map((item) => `
      <div class="packing-item ${item.isPacked ? 'done' : ''}">
        <span>${item.isPacked ? '✓' : '○'}</span>
        <span>${escapeHtml(item.item)}</span>
        <small>${escapeHtml(item.category || 'Other')}</small>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Itinerary - ${escapeHtml(trip.destination)}</title>
  <style>
    :root {
      --brand: #1d4ed8;
      --ink: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
      --bg: #f8fafc;
    }
    * { box-sizing: border-box; }
    body { margin:0; font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: var(--ink); background: #eef2ff; }
    .page { max-width: 1000px; margin: 26px auto; background: white; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 40px rgba(15, 23, 42, 0.14); }
    .hero { padding: 28px 30px; color: white; background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 58%, #22d3ee 100%); }
    .hero h1 { margin: 0 0 8px; font-size: 38px; line-height: 1.1; }
    .hero .subtitle { margin: 0; font-size: 15px; opacity: 0.94; }
    .hero-chips { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
    .hero-chips span { background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 999px; padding: 4px 10px; font-size: 12px; }
    .content { padding: 24px 30px 30px; background: var(--bg); }
    .stats { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 16px; }
    .stat { background: white; border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
    .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
    .stat-value { font-size: 18px; font-weight: 700; }
    .section { margin-top: 16px; }
    .section h2 { margin: 0 0 10px; font-size: 17px; color: #1e293b; }
    .grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .card { background: white; border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
    .card-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
    .subtle { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
    .price { margin-top: 6px; color: #047857; font-size: 13px; font-weight: 700; }
    .tip { margin-top: 6px; padding: 8px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; color: #1e40af; font-size: 12px; }
    .day-card { border: 1px solid var(--line); border-radius: 12px; background: white; margin-top: 10px; overflow: hidden; }
    .day-header { padding: 10px 12px; font-size: 14px; font-weight: 700; background: #eff6ff; color: #1e3a8a; border-bottom: 1px solid #bfdbfe; }
    .timeline { padding: 10px; display: grid; gap: 8px; }
    .activity { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #f8fafc; }
    .activity-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px; }
    .activity-title { font-weight: 700; font-size: 14px; }
    .pill { font-size: 11px; color: #475569; border: 1px solid #cbd5e1; background: white; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
    .meta-row { margin-top: 8px; display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); }
    .packing-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .packing-item { display: grid; grid-template-columns: 16px 1fr auto; align-items: center; gap: 8px; background: white; border: 1px solid var(--line); border-radius: 10px; padding: 9px 10px; font-size: 13px; }
    .packing-item.done { border-color: #6ee7b7; background: #ecfdf5; }
    .packing-item small { color: #64748b; }
    .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid var(--line); color: #64748b; font-size: 12px; }
    @media print {
      body { background: white; }
      .page { margin: 0; box-shadow: none; border-radius: 0; }
      .content { background: white; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <h1>Trip to ${escapeHtml(trip.destination)}</h1>
      <p class="subtitle">${trip.startingFrom ? `From ${escapeHtml(trip.startingFrom)} • ` : ''}${escapeHtml(`${trip.durationDays} days`)} • ${escapeHtml(trip.budgetTier)} budget • ${escapeHtml(currencyLabel)}</p>
      <div class="hero-chips">
        ${trip.transportMode ? `<span>${escapeHtml(trip.transportMode)}</span>` : ''}
        ${(trip.interests || []).map((interest) => `<span>${escapeHtml(interest)}</span>`).join('')}
      </div>
    </header>
    <div class="content">
      <div class="stats">
        <div class="stat"><div class="stat-label">Destination</div><div class="stat-value">${escapeHtml(trip.destination)}</div></div>
        <div class="stat"><div class="stat-label">Duration</div><div class="stat-value">${escapeHtml(`${trip.durationDays} Days`)}</div></div>
        <div class="stat"><div class="stat-label">Budget Tier</div><div class="stat-value">${escapeHtml(trip.budgetTier)}</div></div>
        <div class="stat"><div class="stat-label">Currency</div><div class="stat-value">${escapeHtml(currencyLabel)}</div></div>
      </div>

      ${transportRows ? `<section class="section"><h2>Transport Options</h2><div class="grid">${transportRows}</div></section>` : ''}
      <section class="section"><h2>Day-wise Itinerary</h2>${itineraryRows}</section>
      ${hotelRows ? `<section class="section"><h2>Recommended Hotels</h2><div class="grid">${hotelRows}</div></section>` : ''}
      ${packingRows ? `<section class="section"><h2>Packing Checklist</h2><div class="packing-grid">${packingRows}</div></section>` : ''}

      <div class="footer">Generated by Trao AI Travel Planner on ${new Date().toLocaleString()}</div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `itinerary-${slugify(trip.destination) || 'trip'}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 34;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    const cardWidth = maxWidth;
    let y = 0;

    const ensureSpace = (required = 18) => {
      if (y + required <= pageHeight - margin) {
        return;
      }
      doc.addPage();
      y = margin;
      drawTopBand(true);
    };

    const writeLine = (text, fontSize = 11, weight = 'normal', extraGap = 6, color = [15, 23, 42], x = margin, width = maxWidth) => {
      doc.setFont('helvetica', weight);
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(text, width);
      const lineHeight = fontSize + 4;
      ensureSpace(lines.length * lineHeight + extraGap);
      doc.text(lines, x, y);
      y += lines.length * lineHeight + extraGap;
    };

    const drawTopBand = (isContinuation = false) => {
      doc.setFillColor(29, 78, 216);
      doc.rect(0, 0, pageWidth, isContinuation ? 42 : 122, 'F');
      doc.setFillColor(14, 116, 144);
      doc.rect(0, isContinuation ? 34 : 110, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isContinuation ? 12 : 28);
      doc.text(isContinuation ? `Trip to ${trip.destination} (continued)` : `Trip to ${trip.destination}`, margin, isContinuation ? 26 : 52);
      if (!isContinuation) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(`${trip.startingFrom ? `From ${trip.startingFrom} • ` : ''}${trip.durationDays} days • ${trip.budgetTier} budget • ${currencyLabel}`, margin, 74);
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 92);
      }
      y = isContinuation ? 58 : 144;
    };

    const drawSectionTitle = (title) => {
      ensureSpace(34);
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(margin, y - 2, maxWidth, 24, 6, 6, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 64, 175);
      doc.text(title, margin + 10, y + 14);
      y += 30;
    };

    const drawCardBlock = (title, lines, accent = [29, 78, 216]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const titleLines = doc.splitTextToSize(title, cardWidth - 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const bodyLines = lines.flatMap((line) => doc.splitTextToSize(line, cardWidth - 28));
      const lineHeight = 14;
      const cardHeight = 14 + (titleLines.length * lineHeight) + (bodyLines.length * lineHeight) + 10;
      ensureSpace(cardHeight + 10);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, cardWidth, cardHeight, 8, 8, 'FD');
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.rect(margin, y, 4, cardHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(titleLines, margin + 12, y + 16);
      let contentY = y + 16 + titleLines.length * lineHeight;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(bodyLines, margin + 12, contentY);
      y += cardHeight + 10;
    };

    drawTopBand();

    drawSectionTitle('Trip Snapshot');
    writeLine(`Destination: ${trip.destination}`, 10, 'bold', 3);
    writeLine(`Duration: ${trip.durationDays} days`, 10, 'normal', 3);
    writeLine(`Budget tier: ${trip.budgetTier}`, 10, 'normal', 3);
    writeLine(`Currency: ${currencyLabel}`, 10, 'normal', 10);

    if (trip.transportOptions?.length) {
      drawSectionTitle('Transport Options');
      trip.transportOptions.forEach((option) => {
        const lines = [
          option.detail || 'Route details not provided.',
          option.estimatedCostLocal > 0 ? `${formatMoney(option.estimatedCostLocal, ' / person')}` : 'Cost: Not specified',
          option.bookingTip ? `Tip: ${option.bookingTip}` : ''
        ].filter(Boolean);
        drawCardBlock(option.name || trip.transportMode || 'Transport', lines, [30, 64, 175]);
      });
    }

    drawSectionTitle('Day-wise Itinerary');
    (trip.itinerary || []).forEach((day) => {
      ensureSpace(30);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, maxWidth, 24, 7, 7, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Day ${day.dayNumber}`, margin + 10, y + 16);
      y += 30;

      (day.activities || []).forEach((activity) => {
        const activityLines = [
          `${activity.timeOfDay || 'Anytime'}${activity.estimatedCostLocal > 0 ? ` • ${formatMoney(activity.estimatedCostLocal)}` : ''}`,
          activity.description || 'No description provided.'
        ];
        drawCardBlock(activity.title || 'Activity', activityLines, [14, 116, 144]);
      });
    });

    if (trip.hotels?.length) {
      drawSectionTitle('Recommended Hotels');
      trip.hotels.forEach((hotel) => {
        drawCardBlock(
          hotel.name,
          [
            `Tier: ${hotel.tier || 'Standard'}`,
            hotel.estimatedCostNightLocal > 0 ? `Rate: ${formatMoney(hotel.estimatedCostNightLocal, ' / night')}` : 'Rate: Not specified',
            hotel.rating ? `Rating: ${hotel.rating}` : ''
          ].filter(Boolean),
          [245, 158, 11]
        );
      });
    }

    if (trip.packingList?.length) {
      drawSectionTitle('Packing Checklist');
      trip.packingList.forEach((item) => {
        drawCardBlock(
          `${item.isPacked ? 'Completed' : 'Pending'} • ${item.item}`,
          [`Category: ${item.category || 'Other'}`],
          item.isPacked ? [5, 150, 105] : [100, 116, 139]
        );
      });
    }

    ensureSpace(26);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
    writeLine(`Generated by Trao AI Travel Planner on ${new Date().toLocaleString()}`, 9, 'normal', 0, [100, 116, 139]);
    doc.save(`itinerary-${slugify(trip.destination) || 'trip'}.pdf`);
  };

  const regenerateDay = async (dayNumber) => {
    const response = await apiFetch(`/api/trips/${trip._id}/days/${dayNumber}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ feedback })
    });

    if (response.ok) {
      onChange(await response.json());
    }
  };

  const addActivity = async (dayNumber) => {
    const draft = drafts[dayNumber];
    if (!draft || !draft.title.trim()) {
      return;
    }

    const response = await apiFetch(`/api/trips/${trip._id}/activities`, {
      method: 'POST',
      body: JSON.stringify({
        dayNumber,
        activity: {
          title: draft.title.trim(),
          description: draft.description.trim(),
          estimatedCostUSD: Number(draft.estimatedCostUSD || 0),
          timeOfDay: draft.timeOfDay || 'Afternoon'
        }
      })
    });

    if (response.ok) {
      onChange(await response.json());
      setDrafts((current) => ({ ...current, [dayNumber]: { title: '', description: '', estimatedCostUSD: '', timeOfDay: 'Afternoon' } }));
    }
  };

  const removeActivity = async (dayNumber, activityId) => {
    const response = await apiFetch(`/api/trips/${trip._id}/activities`, {
      method: 'DELETE',
      body: JSON.stringify({ dayNumber, activityId })
    });

    if (response.ok) {
      onChange(await response.json());
    }
  };

  return (
    <div className="card space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-lg font-black text-slate-900">📍 {trip.destination}</h3>
          {trip.startingFrom && <p className="text-xs text-slate-400 mt-0.5">✈ From {trip.startingFrom}</p>}
          <div className="mt-1 flex gap-2 flex-wrap">
            <span className="badge bg-slate-100 text-slate-600 border border-slate-200">{trip.durationDays} days</span>
            <span className="badge bg-indigo-50 text-indigo-600 border border-indigo-100">{trip.budgetTier} budget</span>
            {trip.transportMode && <span className="badge bg-violet-50 text-violet-600 border border-violet-100">🚀 {trip.transportMode}</span>}
            <span className="badge bg-emerald-50 text-emerald-600 border border-emerald-100">{sym} {code}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:w-[520px]">
          <button
            type="button"
            onClick={downloadHtml}
            className="btn-ghost text-xs text-slate-600 hover:bg-slate-100 whitespace-nowrap"
          >
            ⬇ HTML
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="btn-ghost text-xs text-slate-600 hover:bg-slate-100 whitespace-nowrap"
          >
            ⬇ PDF
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="btn-ghost text-xs text-red-600 hover:bg-red-50 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? 'Deleting...' : '🗑 Delete trip'}
            </button>
          )}
          <input className="field min-w-[170px] flex-1 text-xs py-2" placeholder="Feedback for regenerate..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </div>
      </div>

      {/* Transport Options */}
      {trip.transportOptions && trip.transportOptions.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
            {trip.transportMode === 'Flight' ? '✈' : trip.transportMode === 'Train' ? '🚆' : trip.transportMode === 'Bus' ? '🚌' : trip.transportMode === 'Car' ? '🚗' : trip.transportMode === 'Cruise' ? '🚢' : trip.transportMode === 'Motorcycle' ? '🏍' : '🚀'} {trip.transportMode} Options — {trip.startingFrom} → {trip.destination}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {trip.transportOptions.map((opt, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
                <div className="font-semibold text-slate-900 text-sm">{opt.name}</div>
                <div className="text-xs text-slate-500">{opt.detail}</div>
                {opt.estimatedCostLocal > 0 && (
                  <div className="text-xs font-medium text-emerald-600">{sym}{opt.estimatedCostLocal.toLocaleString()} per person</div>
                )}
                {opt.bookingTip && (
                  <div className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 mt-1">💡 {opt.bookingTip}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Days */}
      <div className="space-y-4">
        {trip.itinerary.map((day) => (
          <div key={day.dayNumber} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <span className="font-bold text-slate-800">Day {day.dayNumber}</span>
              <button
                className="btn-ghost text-xs text-indigo-600 hover:bg-indigo-50"
                onClick={() => regenerateDay(day.dayNumber)}
              >
                🔄 Regenerate
              </button>
            </div>
            <div className="p-3 space-y-2">
              {day.activities.map((activity) => (
                <div key={activity._id ?? activity.title} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="font-semibold text-slate-800 text-sm">{activity.title}</span>
                      <p className="text-xs text-slate-500 mt-0.5">{activity.description}</p>
                      {activity.estimatedCostLocal > 0 && (
                        <span className="mt-1 inline-block text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">{sym}{activity.estimatedCostLocal.toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="badge bg-slate-100 text-slate-500 border border-slate-200 text-xs">{activity.timeOfDay}</span>
                      <button className="text-xs text-red-400 hover:text-red-600 font-medium" onClick={() => removeActivity(day.dayNumber, activity._id)}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
              {/* Add activity row */}
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 grid gap-2 md:grid-cols-4">
                <input className="field text-xs py-2 md:col-span-2" placeholder="New activity title" value={(drafts[day.dayNumber]?.title) || ''} onChange={(e) => setDrafts(c => ({ ...c, [day.dayNumber]: { ...(c[day.dayNumber] || { description: '', estimatedCostUSD: '', timeOfDay: 'Afternoon' }), title: e.target.value }}))} />
                <input className="field text-xs py-2" placeholder="Cost (USD)" type="number" value={(drafts[day.dayNumber]?.estimatedCostUSD) || ''} onChange={(e) => setDrafts(c => ({ ...c, [day.dayNumber]: { ...(c[day.dayNumber] || { title: '', description: '', timeOfDay: 'Afternoon' }), estimatedCostUSD: e.target.value }}))} />
                <select className="field text-xs py-2" value={(drafts[day.dayNumber]?.timeOfDay) || 'Afternoon'} onChange={(e) => setDrafts(c => ({ ...c, [day.dayNumber]: { ...(c[day.dayNumber] || { title: '', description: '', estimatedCostUSD: '' }), timeOfDay: e.target.value }}))}>
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Evening</option>
                </select>
                <textarea className="field text-xs py-2 md:col-span-3" rows={2} placeholder="Description (optional)" value={(drafts[day.dayNumber]?.description) || ''} onChange={(e) => setDrafts(c => ({ ...c, [day.dayNumber]: { ...(c[day.dayNumber] || { title: '', estimatedCostUSD: '', timeOfDay: 'Afternoon' }), description: e.target.value }}))} />
                <button className="btn-primary text-xs py-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => addActivity(day.dayNumber)}>+ Add</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hotels */}
      {trip.hotels && trip.hotels.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">🏨 Recommended Hotels</h4>
          <div className="grid gap-3 md:grid-cols-3">
            {trip.hotels.map((hotel) => (
              <div key={hotel.name} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-slate-900 text-sm">{hotel.name}</div>
                <div className="mt-1 flex gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{hotel.tier}</span>
                  <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">${hotel.estimatedCostNightUSD}/night</span>
                  <span className="text-xs text-slate-500 bg-yellow-50 text-yellow-600 border border-yellow-100 rounded-full px-2 py-0.5">⭐ {hotel.rating}</span>
                  {hotel.estimatedCostNightLocal > 0 && (
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">{sym}{hotel.estimatedCostNightLocal.toLocaleString()}/night</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
