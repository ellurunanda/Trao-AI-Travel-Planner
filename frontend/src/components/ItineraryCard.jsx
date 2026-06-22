'use client';

import { useEffect, useState } from 'react';
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

function decodeHtmlEntities(text = '') {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function cleanUpdateText(text = '') {
  return decodeHtmlEntities(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function ItineraryCard({ trip, onChange, onDelete, isDeleting = false }) {
  const [feedback, setFeedback] = useState('');
  const [drafts, setDrafts] = useState({});
  const [fallbackImages, setFallbackImages] = useState([]);
  const [regeneratingDayNumber, setRegeneratingDayNumber] = useState(null);
  const [isRegeneratingTrip, setIsRegeneratingTrip] = useState(false);
  const [regenerateCooldownUntil, setRegenerateCooldownUntil] = useState(null);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0);

  const sym = trip.currency?.symbol || '$';
  const code = trip.currency?.code || 'USD';
  const currencyLabel = `${sym}${code ? ` ${code}` : ''}`;
  const formatMoney = (value, suffix = '') => (value > 0 ? `${sym}${Number(value).toLocaleString()}${suffix}` : '');
  const displayImages = trip.destinationImages?.length ? trip.destinationImages : fallbackImages;
  const isCooldownActive = cooldownSecondsLeft > 0;

  useEffect(() => {
    if (!regenerateCooldownUntil) {
      setCooldownSecondsLeft(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((regenerateCooldownUntil - Date.now()) / 1000));
      setCooldownSecondsLeft(remaining);
      if (remaining === 0) {
        setRegenerateCooldownUntil(null);
      }
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);
    return () => clearInterval(intervalId);
  }, [regenerateCooldownUntil]);

  useEffect(() => {
    if (trip.destinationImages?.length || !trip.destination) {
      setFallbackImages([]);
      return;
    }

    let active = true;
    const loadFallbackImages = async () => {
      try {
        const query = encodeURIComponent(trip.destination);
        const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${query}&gsrnamespace=0&gsrlimit=6&prop=pageimages|info&piprop=thumbnail&pithumbsize=1200&inprop=url`);
        if (!response.ok || !active) {
          return;
        }

        const payload = await response.json();
        const pages = Object.values(payload?.query?.pages || {});
        const images = pages
          .map((page) => {
            const url = page?.thumbnail?.source || '';
            if (!url) {
              return null;
            }
            return {
              url,
              title: page?.title || trip.destination,
              source: 'Wikipedia'
            };
          })
          .filter(Boolean)
          .slice(0, 6);

        if (active) {
          setFallbackImages(images);
        }
      } catch (error) {
        if (active) {
          setFallbackImages([]);
        }
      }
    };

    loadFallbackImages();
    return () => {
      active = false;
    };
  }, [trip.destination, trip.destinationImages?.length]);

  const applyRegenerateCooldown = (seconds) => {
    if (!seconds || seconds <= 0) {
      return;
    }
    setRegenerateCooldownUntil(Date.now() + seconds * 1000);
  };

  const downloadHtml = () => {
    const imageRows = (displayImages || []).map((image) => `
      <article class="image-card">
        <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.title || trip.destination)}" />
        <div class="image-caption">${escapeHtml(image.title || trip.destination)}</div>
      </article>
    `).join('');

    const seasonRows = (trip.seasonTips || []).map((tip) => `
      <article class="card">
        <div class="card-title">${escapeHtml(tip.title || 'Season Tip')}</div>
        <p class="subtle">${escapeHtml(tip.detail || '')}</p>
      </article>
    `).join('');

    const updateRows = (trip.travelUpdates || []).map((update) => `
      <article class="card">
        <div class="card-title">${escapeHtml(cleanUpdateText(update.title || 'Travel update'))}</div>
        ${update.publishedAt ? `<p class="subtle">Published: ${escapeHtml(update.publishedAt)}</p>` : ''}
        ${update.summary ? `<p class="subtle">${escapeHtml(cleanUpdateText(update.summary))}</p>` : ''}
        ${update.url ? `<p class="tip"><strong>Source:</strong> <a href="${escapeHtml(update.url)}">${escapeHtml(update.source || 'Read more')}</a></p>` : ''}
      </article>
    `).join('');

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
    .image-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
    .image-card { background: white; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .image-card img { width: 100%; height: 150px; object-fit: cover; display: block; }
    .image-caption { font-size: 12px; color: var(--muted); padding: 8px 10px; }
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

      ${imageRows ? `<section class="section"><h2>Destination Highlights</h2><div class="image-grid">${imageRows}</div></section>` : ''}
      ${seasonRows ? `<section class="section"><h2>Season Insights</h2><div class="grid">${seasonRows}</div></section>` : ''}
      ${updateRows ? `<section class="section"><h2>Latest Travel Updates</h2><div class="grid">${updateRows}</div></section>` : ''}
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
        if (trip.transportMode) {
          doc.text(`Transport: ${trip.transportMode}`, margin, 92);
        }
        if (trip.interests?.length) {
          doc.text(`Interests: ${trip.interests.join(', ')}`, margin, 108);
        }
      }
      y = isContinuation ? 58 : 156;
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

    if (displayImages?.length) {
      drawSectionTitle('Destination Highlights');
      displayImages.forEach((image) => {
        const lines = [
          image.source ? `Source: ${image.source}` : '',
          image.url || ''
        ].filter(Boolean);
        drawCardBlock(image.title || trip.destination, lines, [37, 99, 235]);
      });
    }

    if (trip.seasonTips?.length) {
      drawSectionTitle('Season Insights');
      trip.seasonTips.forEach((tip) => {
        drawCardBlock(tip.title || 'Season tip', [tip.detail || ''], [124, 58, 237]);
      });
    }

    if (trip.travelUpdates?.length) {
      drawSectionTitle('Latest Travel Updates');
      trip.travelUpdates.forEach((update) => {
        const lines = [
          update.publishedAt ? `Published: ${update.publishedAt}` : '',
          cleanUpdateText(update.summary || ''),
          update.url ? `Source: ${update.url}` : ''
        ].filter(Boolean);
        drawCardBlock(cleanUpdateText(update.title || 'Travel update'), lines, [3, 105, 161]);
      });
    }

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
            `${hotel.tier || 'Standard'}`,
            hotel.estimatedCostNightLocal > 0 ? `${formatMoney(hotel.estimatedCostNightLocal, ' / night')}` : 'Rate on request',
            hotel.rating ? `⭐ ${hotel.rating}` : ''
          ].filter(Boolean),
          [245, 158, 11]
        );
      });
    }

    if (trip.packingList?.length) {
      drawSectionTitle('Packing Checklist');
      trip.packingList.forEach((item) => {
        drawCardBlock(
          `${item.isPacked ? '✓' : '○'} ${item.item}`,
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
    setRegeneratingDayNumber(dayNumber);
    try {
      const response = await apiFetch(`/api/trips/${trip._id}/days/${dayNumber}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ feedback })
      });

      if (response.ok) {
        onChange(await response.json());
        return;
      }

      const error = await response.json().catch(() => ({}));
      applyRegenerateCooldown(error.retryAfterSeconds);
      alert(error.message || 'Could not regenerate this day. Please try again.');
    } finally {
      setRegeneratingDayNumber(null);
    }
  };

  const regenerateFullTrip = async () => {
    setIsRegeneratingTrip(true);
    try {
      const response = await apiFetch(`/api/trips/${trip._id}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ feedback })
      });

      if (response.ok) {
        onChange(await response.json());
        return;
      }

      const error = await response.json().catch(() => ({}));
      applyRegenerateCooldown(error.retryAfterSeconds);
      alert(error.message || 'Could not regenerate the full trip. Please try again.');
    } finally {
      setIsRegeneratingTrip(false);
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
          <button
            type="button"
            onClick={regenerateFullTrip}
            disabled={isRegeneratingTrip || regeneratingDayNumber !== null || isCooldownActive}
            className="btn-primary text-xs whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRegeneratingTrip ? 'Regenerating trip...' : isCooldownActive ? `Wait ${cooldownSecondsLeft}s` : '🔄 Full trip'}
          </button>
        </div>
      </div>

      {isCooldownActive && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Gemini rate limit reached. Please wait about <span className="font-semibold">{cooldownSecondsLeft}s</span> before trying regenerate again.
        </div>
      )}

      {/* Transport Options */}
      {displayImages && displayImages.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">🖼 Destination Highlights</h4>
          <div className="grid gap-3 md:grid-cols-3">
            {displayImages.map((image, index) => (
              <div key={`${image.url}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <img src={image.url} alt={image.title || trip.destination} className="h-44 w-full object-cover" loading="lazy" />
                <p className="max-h-10 overflow-hidden px-3 py-2 text-xs font-medium text-slate-600">{image.title || trip.destination}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {trip.seasonTips && trip.seasonTips.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">🌤 Season Insights</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {trip.seasonTips.map((tip, index) => (
              <div key={`${tip.title}-${index}`} className="rounded-xl border border-violet-100 bg-violet-50 p-4">
                <div className="font-semibold text-violet-800 text-sm">{tip.title || 'Season Tip'}</div>
                <p className="text-xs text-violet-700 mt-1">{tip.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {trip.travelUpdates && trip.travelUpdates.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">📰 Latest Travel Updates</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {trip.travelUpdates.map((update, index) => (
              <div key={`${update.url || update.title}-${index}`} className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                <div className="max-h-16 overflow-hidden font-semibold text-sky-900 text-sm">{cleanUpdateText(update.title)}</div>
                {update.publishedAt && <div className="text-xs text-sky-700 mt-1">{update.publishedAt}</div>}
                {update.summary && <p className="max-h-16 overflow-hidden break-words text-xs text-slate-600 mt-1">{cleanUpdateText(update.summary)}</p>}
                {update.url && (
                  <a href={update.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-sky-700 hover:underline">
                    Read source ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
                disabled={isRegeneratingTrip || regeneratingDayNumber === day.dayNumber || isCooldownActive}
                onClick={() => regenerateDay(day.dayNumber)}
              >
                {regeneratingDayNumber === day.dayNumber ? 'Regenerating...' : isCooldownActive ? `Wait ${cooldownSecondsLeft}s` : '🔄 Regenerate'}
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
                  <span className="text-xs bg-yellow-50 text-yellow-600 border border-yellow-100 rounded-full px-2 py-0.5">⭐ {hotel.rating}</span>
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
