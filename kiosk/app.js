/* ═══════════════════════════════════════════════════════════
   KIOSK APP — app.js
   Pure vanilla JS, no build step. CDN: Socket.io 4.x
   Routes:
     index.html            → room selector
     index.html?roomId=ID  → kiosk display for room ID
   Data: GET /api/rooms/:id/kiosk
═══════════════════════════════════════════════════════════ */

const CONFIG = {
  apiUrl: `${window.location.protocol}//${window.location.hostname}:3000/api`,
  socketUrl: `${window.location.protocol}//${window.location.hostname}:3000`,
  refresh: 30_000,
};

const RING_LEN = 2 * Math.PI * 52;
const ENDING_SOON_MS = 10 * 60 * 1000;
const BOOKED_RING_WINDOW_MS = 45 * 60 * 1000;
const AVAILABLE_RING_WINDOW_MS = 2 * 60 * 60 * 1000;

const GRID_START_HOUR = 8;
const GRID_END_HOUR = 18;

let roomId = null;
let data = null;
let socket = null;
let _clock = null;
let _refresh = null;

/** 0 = week containing today; -1 / +1 = navigate weeks */
let weekNav = 0;
/** 'live' | 'weekly' */
let viewMode = 'live';

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtDuration(startIso, endIso) {
  const mins = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  return mins >= 60
    ? `${Math.floor(mins / 60)}h ${mins % 60 ? (mins % 60) + 'm' : ''}`.trim()
    : `${mins} min`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function sundayOfWeekContaining(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

function getVisibleWeekStartMs() {
  const d = new Date(sundayOfWeekContaining(new Date()));
  d.setDate(d.getDate() + weekNav * 7);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatWeekRangeLabel(weekStartMs) {
  const a = new Date(weekStartMs);
  const b = new Date(weekStartMs);
  b.setDate(b.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  const left = a.toLocaleDateString(undefined, opts);
  const right = b.toLocaleDateString(undefined, { ...opts, year: 'numeric' });
  return `${left} – ${right}`;
}

function gridWindowForDay(dayMidnightMs) {
  const s = new Date(dayMidnightMs);
  s.setHours(GRID_START_HOUR, 0, 0, 0);
  const e = new Date(dayMidnightMs);
  e.setHours(GRID_END_HOUR, 0, 0, 0);
  return { g0: s.getTime(), g1: e.getTime() };
}

function fmtHeroCountdown(ms) {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setRingProgress(p) {
  const arc = $('ring-arc');
  if (!arc) return;
  const clamped = Math.min(1, Math.max(0, p));
  arc.style.strokeDashoffset = String(RING_LEN * (1 - clamped));
}

function syncStateClasses() {
  const screen = $('screen-kiosk');
  if (!screen || !data) return;
  screen.classList.remove('state-available', 'state-ongoing', 'state-upcoming', 'state-ending-soon');
  screen.classList.add(`state-${String(data.status).toLowerCase()}`);

  if (data.status === 'ONGOING' && data.currentBooking) {
    const diff = new Date(data.currentBooking.endTime).getTime() - Date.now();
    if (diff > 0 && diff <= ENDING_SOON_MS) screen.classList.add('state-ending-soon');
  }
}

function renderTimeline() {
  const el = $('schedule-scroll');
  if (!el || !data) return;

  const schedule = Array.isArray(data.schedule) ? data.schedule : [];
  const t0 = startOfLocalDay(new Date());
  const t1 = t0 + 86400000;
  const t2 = t1 + 86400000;

  const today = schedule.filter((b) => {
    const s = new Date(b.startTime).getTime();
    return s >= t0 && s < t1;
  });
  const tomorrow = schedule.filter((b) => {
    const s = new Date(b.startTime).getTime();
    return s >= t1 && s < t2;
  });

  if (!today.length && !tomorrow.length) {
    el.innerHTML =
      '<p class="tl-empty">No confirmed reservations in the next two days for this room.</p>';
    return;
  }

  const rowHtml = (b) => {
    const live =
      data.status === 'ONGOING' &&
      data.currentBooking &&
      String(b._id) === String(data.currentBooking._id);
    const pill = live ? '<span class="tl-live-pill">Live</span>' : '';
    return `
      <div class="tl-row${live ? ' is-live' : ''}">
        <div class="tl-row-top">
          <div class="tl-row-time">${escapeHtml(fmtTime(b.startTime))} – ${escapeHtml(fmtTime(b.endTime))}</div>
          ${pill}
        </div>
        <div class="tl-row-title">${escapeHtml(b.title || 'Meeting')}</div>
        <div class="tl-row-user">${escapeHtml(b.userName || '')}</div>
      </div>`;
  };

  let html = '';
  if (today.length) {
    html += '<div class="tl-section-label">Today</div>' + today.map(rowHtml).join('');
  }
  if (tomorrow.length) {
    html += '<div class="tl-section-label">Tomorrow</div>' + tomorrow.map(rowHtml).join('');
  }
  el.innerHTML = html;
}

function isSameLocalDay(aMs, bMs) {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function bookingSegmentsForDay(booking, dayMidnightMs) {
  const S = new Date(booking.startTime).getTime();
  const E = new Date(booking.endTime).getTime();
  const { g0, g1 } = gridWindowForDay(dayMidnightMs);
  const v0 = Math.max(S, g0);
  const v1 = Math.min(E, g1);
  if (v1 <= v0) return null;
  const total = g1 - g0;
  return {
    topPct: ((v0 - g0) / total) * 100,
    heightPct: ((v1 - v0) / total) * 100,
  };
}

function renderWeekly() {
  const root = $('weekly-grid');
  if (!root) return;

  const weekStartMs = getVisibleWeekStartMs();
  const label = $('week-range-label');
  if (label) label.textContent = formatWeekRangeLabel(weekStartMs);

  const now = Date.now();
  const todayMidnight = startOfLocalDay(new Date());

  const dayHeaders = [];
  const dayCols = [];
  for (let d = 0; d < 7; d++) {
    const dayMs = weekStartMs + d * 86400000;
    const dt = new Date(dayMs);
    const wk = dt.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
    const num = dt.getDate();
    const isToday = isSameLocalDay(dayMs, todayMidnight);
    dayHeaders.push(
      `<div class="weekly-day-h${isToday ? ' is-today' : ''}">${escapeHtml(wk)} ${num}</div>`,
    );

    const schedule = data && Array.isArray(data.schedule) ? data.schedule : [];
    const eventsHtml = [];
    for (const b of schedule) {
      const seg = bookingSegmentsForDay(b, dayMs);
      if (!seg) continue;
      const live =
        data &&
        data.status === 'ONGOING' &&
        data.currentBooking &&
        String(b._id) === String(data.currentBooking._id);
      eventsHtml.push(`
        <div class="weekly-event${live ? ' is-live' : ''}" style="top:${seg.topPct}%;height:${seg.heightPct}%;">
          <div class="weekly-event-title">${escapeHtml(b.title || 'Meeting')}</div>
          <div class="weekly-event-time">${escapeHtml(fmtTime(b.startTime))} – ${escapeHtml(fmtTime(b.endTime))}</div>
          <div class="weekly-event-user">${escapeHtml(b.userName || '')}</div>
        </div>`);
    }

    dayCols.push(
      `<div class="weekly-col${isToday ? ' is-today' : ''}">${eventsHtml.join('')}</div>`,
    );
  }

  const timeSlots = [];
  for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
    const pct = ((h - GRID_START_HOUR) / (GRID_END_HOUR - GRID_START_HOUR)) * 100;
    const t = new Date(2000, 0, 1, h, 0, 0);
    const lab = t.toLocaleTimeString(undefined, { hour: 'numeric' });
    timeSlots.push(
      `<div class="weekly-time-slot" style="top:${pct}%">${escapeHtml(lab)}</div>`,
    );
  }

  root.innerHTML = `
    <div class="weekly-head-row">
      <div class="weekly-corner"></div>
      ${dayHeaders.join('')}
    </div>
    <div class="weekly-body">
      <div class="weekly-times">${timeSlots.join('')}</div>
      <div class="weekly-cols-wrap" id="weekly-cols-wrap">
        ${dayCols.join('')}
        <div id="weekly-now-line"></div>
      </div>
    </div>`;

  updateWeeklyNowLine();
}

function updateWeeklyNowLine() {
  const line = $('weekly-now-line');
  const wrap = $('weekly-cols-wrap');
  if (!line || !wrap || viewMode !== 'weekly') return;

  const now = Date.now();
  const todayMidnight = startOfLocalDay(new Date());
  const weekStartMs = getVisibleWeekStartMs();
  const weekEndMs = weekStartMs + 7 * 86400000;
  if (now < weekStartMs || now >= weekEndMs) {
    line.classList.remove('is-visible');
    return;
  }

  const { g0, g1 } = gridWindowForDay(todayMidnight);
  if (now < g0 || now > g1) {
    line.classList.remove('is-visible');
    return;
  }

  const total = g1 - g0;
  const pct = ((now - g0) / total) * 100;
  line.style.top = `${pct}%`;
  line.classList.add('is-visible');
}

function setView(mode) {
  viewMode = mode;
  const livePanel = $('panel-live');
  const weekPanel = $('panel-weekly');
  const btnLive = $('btn-live-view');
  const btnWeek = $('btn-weekly-view');

  if (mode === 'weekly') {
    livePanel.classList.add('hidden');
    weekPanel.classList.remove('hidden');
    btnLive.classList.remove('is-active');
    btnWeek.classList.add('is-active');
    renderWeekly();
  } else {
    weekPanel.classList.add('hidden');
    livePanel.classList.remove('hidden');
    btnWeek.classList.remove('is-active');
    btnLive.classList.add('is-active');
  }
}

function wireKioskChrome() {
  $('btn-live-view')?.addEventListener('click', () => setView('live'));
  $('btn-weekly-view')?.addEventListener('click', () => setView('weekly'));
  $('btn-select-room')?.addEventListener('click', () => goToSelector());
  $('week-prev')?.addEventListener('click', () => {
    weekNav -= 1;
    renderWeekly();
  });
  $('week-next')?.addEventListener('click', () => {
    weekNav += 1;
    renderWeekly();
  });
  $('week-today')?.addEventListener('click', () => {
    weekNav = 0;
    renderWeekly();
  });
}

function init() {
  const params = new URLSearchParams(window.location.search);
  roomId = params.get('roomId');

  if (roomId) {
    show('screen-kiosk');
    hide('screen-selector');
    hide('screen-loading');
    wireKioskChrome();
    startKioskMode();
  } else {
    hide('screen-loading');
    show('screen-selector');
    loadRoomSelector();
  }
}

async function loadRoomSelector() {
  try {
    const res = await fetch(`${CONFIG.apiUrl}/rooms`);
    const json = await res.json();
    renderRooms(json.rooms || []);
  } catch (e) {
    $('rooms-grid').innerHTML =
      '<p style="color:#f87171;text-align:center;grid-column:1/-1">Failed to load rooms. Is the backend running?</p>';
  }
}

function renderRooms(rooms) {
  const grid = $('rooms-grid');
  if (!rooms.length) {
    grid.innerHTML =
      '<p style="color:#64748b;text-align:center;grid-column:1/-1">No active rooms found.</p>';
    return;
  }

  Promise.allSettled(
    rooms.map((r) => fetch(`${CONFIG.apiUrl}/rooms/${r._id}/kiosk`).then((x) => x.json())),
  ).then((results) => {
    grid.innerHTML = '';
    rooms.forEach((room, i) => {
      const st =
        results[i].status === 'fulfilled' ? results[i].value.status || 'AVAILABLE' : 'AVAILABLE';
      const card = document.createElement('div');
      card.className = 'room-card';
      card.innerHTML = `
        <div class="room-card-name">${escapeHtml(room.name)}</div>
        <div class="room-card-cap">Capacity: ${escapeHtml(String(room.capacity ?? '—'))}</div>
        <span class="room-card-badge badge-${String(st).toLowerCase()}">${escapeHtml(st)}</span>
      `;
      card.addEventListener('click', () => {
        window.location.href = `?roomId=${encodeURIComponent(room._id)}`;
      });
      grid.appendChild(card);
    });
  });
}

function startKioskMode() {
  fetchData();
  _clock = setInterval(tickClock, 1000);
  tickClock();
  _refresh = setInterval(fetchData, CONFIG.refresh);
  connectSocket();
}

function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  $('clock-time').textContent = `${h}:${m}`;
  $('clock-ampm').textContent = ampm;
  $('clock-date').textContent = now.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  updateHeroUi();
  updateWeeklyNowLine();
}

async function fetchData() {
  try {
    const res = await fetch(`${CONFIG.apiUrl}/rooms/${roomId}/kiosk`);
    if (!res.ok) throw new Error(res.statusText);
    const json = await res.json();
    data = json;
    hide('error-banner');
    renderKiosk();
  } catch (e) {
    show('error-banner');
    console.error('[Kiosk] fetch error:', e);
  }
}

function renderKiosk() {
  if (!data) return;

  $('room-name').textContent = data.room?.name || 'Room';
  $('room-detail').textContent = data.room?.capacity
    ? `${data.room.capacity} seats${data.room.floor ? ` · Floor ${data.room.floor}` : ''}`
    : '';

  syncStateClasses();

  const label = $('kiosk-status-label');
  const map = { AVAILABLE: 'AVAILABLE', ONGOING: 'IN PROGRESS', UPCOMING: 'BOOKED' };
  label.textContent = map[data.status] || data.status;

  hide('block-available');
  hide('block-ongoing');
  hide('block-upcoming');

  if (data.status === 'ONGOING' && data.currentBooking) {
    const b = data.currentBooking;
    $('ongoing-title').textContent = b.title || 'Meeting';
    $('ongoing-user').textContent = b.userName ? `Organizer · ${b.userName}` : 'Organizer · —';
    $('ongoing-time').textContent = `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)} · ${fmtDuration(b.startTime, b.endTime)}`;
    show('block-ongoing');
  } else if (data.status === 'UPCOMING' && data.nextBooking) {
    const b = data.nextBooking;
    $('upcoming-title').textContent = b.title || 'Meeting';
    $('upcoming-user').textContent = b.userName ? `Organizer · ${b.userName}` : 'Organizer · —';
    $('upcoming-time').textContent = `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)} · ${fmtDuration(b.startTime, b.endTime)}`;
    show('block-upcoming');
  } else {
    show('block-available');
  }

  renderTimeline();
  if (viewMode === 'weekly') renderWeekly();
  updateHeroUi();
}

function updateHeroUi() {
  if (!data) return;
  const heroEl = $('hero-countdown');
  const caption = $('countdown-caption');
  const now = Date.now();

  if (data.status === 'ONGOING' && data.currentBooking) {
    const end = new Date(data.currentBooking.endTime).getTime();
    const start = new Date(data.currentBooking.startTime).getTime();
    const diff = end - now;
    if (diff <= 0) {
      heroEl.textContent = '0:00';
      setTimeout(fetchData, 2500);
    } else {
      heroEl.textContent = fmtHeroCountdown(diff);
    }
    const total = end - start;
    const elapsed = now - start;
    setRingProgress(total > 0 ? elapsed / total : 0);
    caption.textContent =
      diff > 0 && diff <= ENDING_SOON_MS ? 'Time remaining' : 'Session ends in';
    syncStateClasses();
    return;
  }

  if (data.status === 'UPCOMING' && data.nextBooking) {
    const start = new Date(data.nextBooking.startTime).getTime();
    const diff = start - now;
    heroEl.textContent = diff <= 0 ? '0:00' : fmtHeroCountdown(diff);
    caption.textContent = 'Session begins in';
    setRingProgress(1 - Math.min(1, Math.max(0, diff / BOOKED_RING_WINDOW_MS)));
    return;
  }

  const nb = data.nextBooking;
  if (nb) {
    const start = new Date(nb.startTime).getTime();
    const diff = start - now;
    heroEl.textContent = diff <= 0 ? '0:00' : fmtHeroCountdown(diff);
    caption.textContent = 'Next reservation begins in';
    setRingProgress(1 - Math.min(1, Math.max(0, diff / AVAILABLE_RING_WINDOW_MS)));
  } else {
    heroEl.textContent = '—';
    caption.textContent = 'No upcoming sessions';
    setRingProgress(0);
  }
}

function connectSocket() {
  socket = io(CONFIG.socketUrl, { transports: ['websocket', 'polling'] });
  socket.on('connect', () => console.log('[Socket] connected', socket.id));
  socket.on('disconnect', () => console.warn('[Socket] disconnected'));
  const refresh = () => fetchData();
  socket.on('booking:created', refresh);
  socket.on('booking:updated', refresh);
  socket.on('booking:cancelled', refresh);
}

function goToSelector() {
  clearInterval(_clock);
  clearInterval(_refresh);
  if (socket) socket.disconnect();
  window.location.href = window.location.pathname;
}

document.addEventListener('DOMContentLoaded', init);
