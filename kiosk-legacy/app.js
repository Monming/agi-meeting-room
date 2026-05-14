/* ═══════════════════════════════════════════════════════════
   KIOSK APP — app.js
   Pure vanilla JS, no build step. CDN: Socket.io 4.x
   Routes:
     index.html            → room selector
     index.html?roomId=ID  → kiosk display for room ID
═══════════════════════════════════════════════════════════ */

/* ── CONFIG ─────────────────────────────────────────────── */
const host = window.location.hostname || 'localhost';
const CONFIG = {
  apiUrl:    `http://${host}:3000/api`,
  socketUrl: `http://${host}:3000`,
  refresh:   30_000
};

/* ── WEEKLY GRID CONSTANTS ───────────────────────────────── */
const WK_HOUR_START = 8;   // 8 AM
const WK_HOUR_END   = 18;  // 6 PM  (10 hours shown)
const WK_HOURS      = WK_HOUR_END - WK_HOUR_START;
const DAY_NAMES     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ── STATE ─────────────────────────────────────────────── */
let roomId   = null;
let data     = null;
let socket   = null;
let _clock   = null;
let _refresh = null;

let isWeeklyView  = false;
let weekData      = null;
let _weekRefresh  = null;
let weekOffset    = 0;   // 0 = current week, ±N = shift by N weeks

/* ── HELPERS ────────────────────────────────────────────── */
const $    = id  => document.getElementById(id);
const show = id  => $(id) && $(id).classList.remove('hidden');
const hide = id  => $(id) && $(id).classList.add('hidden');

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtDuration(startIso, endIso) {
  const mins = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  return mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60 ? mins%60+'m' : ''}`.trim() : `${mins} min`;
}
/** Return local YYYY-MM-DD string */
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
/** Monday of the week that contains `date`, shifted by `offset` weeks */
function getMondayOfWeek(offset = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const day  = now.getDay();          // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}
/** pixels from top of grid for a given Date */
function toPx(date) {
  const HOUR_PX = parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue('--wk-hour-px')) || 72;
  const h = date.getHours() + date.getMinutes() / 60;
  return Math.max(0, (h - WK_HOUR_START) * HOUR_PX);
}
function hourPx() {
  return parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue('--wk-hour-px')) || 72;
}

/* ── INIT ───────────────────────────────────────────────── */
function init() {
  const params = new URLSearchParams(window.location.search);
  roomId = params.get('roomId');

  if (roomId) {
    show('screen-kiosk');
    hide('screen-selector');
    hide('screen-loading');
    startKioskMode();
  } else {
    hide('screen-loading');
    show('screen-selector');
    loadRoomSelector();
  }
}

/* ══ ROOM SELECTOR ══════════════════════════════════════ */
async function loadRoomSelector() {
  try {
    const res  = await fetch(`${CONFIG.apiUrl}/rooms`);
    const json = await res.json();
    renderRooms(json.rooms || []);
  } catch (e) {
    $('rooms-grid').innerHTML = '<p style="color:#f87171;text-align:center;grid-column:1/-1">⚠ Failed to load rooms. Is the backend running?</p>';
  }
}

function renderRooms(rooms) {
  const grid = $('rooms-grid');
  if (!rooms.length) {
    grid.innerHTML = '<p style="color:#64748b;text-align:center;grid-column:1/-1">No active rooms found.</p>';
    return;
  }
  Promise.allSettled(
    rooms.map(r => fetch(`${CONFIG.apiUrl}/rooms/${r._id}/kiosk`).then(x => x.json()))
  ).then(results => {
    grid.innerHTML = '';
    rooms.forEach((room, i) => {
      const st   = results[i].status === 'fulfilled' ? (results[i].value.status || 'AVAILABLE') : 'AVAILABLE';
      const card = document.createElement('div');
      card.className = 'room-card';
      card.innerHTML = `
        <div class="room-card-name">${room.name}</div>
        <div class="room-card-cap">👥 Capacity: ${room.capacity}</div>
        <span class="room-card-badge badge-${st.toLowerCase()}">${st}</span>
      `;
      card.addEventListener('click', () => { window.location.href = `?roomId=${room._id}`; });
      grid.appendChild(card);
    });
  });
}

/* ══ KIOSK MODE ══════════════════════════════════════════ */
function startKioskMode() {
  fetchData();
  _clock   = setInterval(tickClock, 1000);
  tickClock();
  _refresh = setInterval(fetchData, CONFIG.refresh);
  connectSocket();
}

/* ── Clock ──────────────────────────────────────────────── */
function tickClock() {
  const now  = new Date();
  let   h    = now.getHours();
  const m    = String(now.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  $('clock-time').textContent = `${h}:${m}`;
  $('clock-ampm').textContent = ampm;
  $('clock-date').textContent = now.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' });
  updateCountdown();
  if (isWeeklyView) updateNowLine();
}

/* ── Kiosk data fetch ────────────────────────────────────── */
async function fetchData() {
  try {
    const res  = await fetch(`${CONFIG.apiUrl}/rooms/${roomId}/kiosk`);
    if (!res.ok) throw new Error(res.statusText);
    data = await res.json();
    hide('error-banner');
    renderKiosk();
  } catch (e) {
    show('error-banner');
    console.error('[Kiosk] fetch error:', e);
  }
}

/* ── Render live view ────────────────────────────────────── */
function renderKiosk() {
  if (!data) return;

  $('room-name').textContent   = data.room?.name || 'Unknown Room';
  $('room-detail').textContent = data.room?.capacity
    ? `👥 ${data.room.capacity} seats${data.room.floor ? '  ·  Floor ' + data.room.floor : ''}`
    : '';

  const screen = $('screen-kiosk');
  screen.classList.remove('state-available', 'state-ongoing', 'state-upcoming');
  screen.classList.add(`state-${data.status.toLowerCase()}`);

  const labels = { AVAILABLE: '✓  Available', ONGOING: '●  In Use', UPCOMING: '◎  Reserved Soon' };
  $('status-badge').textContent = labels[data.status] || data.status;

  hide('card-available'); hide('card-ongoing'); hide('card-upcoming');

  if (data.status === 'ONGOING' && data.currentBooking) {
    const b = data.currentBooking;
    $('ongoing-title').textContent = b.title || 'Meeting';
    $('ongoing-user').textContent  = '👤 ' + (b.userName || '—');
    $('ongoing-time').textContent  = `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}  ·  ${fmtDuration(b.startTime, b.endTime)}`;
    show('card-ongoing');
  } else if (data.status === 'UPCOMING' && data.nextBooking) {
    const b = data.nextBooking;
    $('upcoming-title').textContent = b.title || 'Meeting';
    $('upcoming-user').textContent  = '👤 ' + (b.userName || '—');
    $('upcoming-time').textContent  = `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}  ·  ${fmtDuration(b.startTime, b.endTime)}`;
    show('card-upcoming');
  } else {
    show('card-available');
  }

  if (data.status === 'ONGOING' && data.nextBooking) {
    const nb = data.nextBooking;
    $('next-time').textContent       = `${fmtTime(nb.startTime)} – ${fmtTime(nb.endTime)}`;
    $('next-title-text').textContent = nb.title || 'Meeting';
    $('next-user').textContent       = nb.userName || '';
    show('next-bar');
  } else {
    hide('next-bar');
  }

  updateCountdown();
}

/* ── Countdown ───────────────────────────────────────────── */
function updateCountdown() {
  if (!data || data.status !== 'ONGOING' || !data.currentBooking) return;
  const diff = new Date(data.currentBooking.endTime).getTime() - Date.now();
  const el   = $('countdown-text');
  if (diff <= 0) { el.textContent = 'Ending…'; setTimeout(fetchData, 3000); return; }
  const totalMins = Math.floor(diff / 60000);
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const secs = Math.floor((diff % 60000) / 1000);
  el.textContent = hrs > 0
    ? `${hrs}h ${mins}m remaining`
    : mins > 0 ? `${mins}m ${secs}s remaining` : `${secs}s remaining`;
  el.classList.toggle('urgent', totalMins < 5);
}

/* ══ WEEKLY VIEW ══════════════════════════════════════════ */

async function toggleWeeklyView() {
  isWeeklyView = !isWeeklyView;
  const btn = $('btn-weekly-toggle');

  if (isWeeklyView) {
    hide('view-live');
    show('view-weekly');
    btn.textContent = '📺 Live View';
    btn.classList.add('active');
    weekOffset = 0;
    await fetchWeeklyData();
    _weekRefresh = setInterval(fetchWeeklyData, CONFIG.refresh);
  } else {
    show('view-live');
    hide('view-weekly');
    btn.textContent = '📅 Weekly';
    btn.classList.remove('active');
    clearInterval(_weekRefresh);
    _weekRefresh = null;
  }
}

async function shiftWeek(delta) {
  weekOffset += delta;
  await fetchWeeklyData();
}

async function goToThisWeek() {
  if (weekOffset === 0) return;
  weekOffset = 0;
  await fetchWeeklyData();
}

async function fetchWeeklyData() {
  try {
    const monday    = getMondayOfWeek(weekOffset);
    const startDate = toLocalDateStr(monday);
    const url       = `${CONFIG.apiUrl}/bookings/kiosk-week?roomId=${roomId}&startDate=${startDate}`;
    const res       = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    weekData = await res.json();
    renderWeeklyCalendar();
  } catch (e) {
    console.error('[Weekly] fetch error:', e);
  }
}

function renderWeeklyCalendar() {
  if (!weekData) return;

  const HPIX    = hourPx();
  const todayStr = toLocalDateStr(new Date());

  /* ── Week range label ── */
  const wStart = new Date(weekData.weekStart + 'T00:00:00');
  const wEnd   = new Date(wStart);
  wEnd.setDate(wStart.getDate() + 6);
  const fmtLabel = d => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  $('wk-range').textContent = `${fmtLabel(wStart)} – ${fmtLabel(wEnd)}, ${wEnd.getFullYear()}`;

  /* ── Build day-header row ── */
  const headerGrid = $('wk-header-grid');
  // Remove previous day heads (keep corner)
  [...headerGrid.querySelectorAll('.wk-day-head')].forEach(el => el.remove());

  weekData.days.forEach(day => {
    const d       = new Date(day.date + 'T00:00:00');
    const isToday = day.date === todayStr;
    const el      = document.createElement('div');
    el.className  = `wk-day-head${isToday ? ' wk-today' : ''}`;
    const dateNum = d.getDate();
    const dayName = DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1]; // Mon=0 offset
    el.innerHTML  = `<span class="wk-day-name">${dayName}</span><span class="wk-day-date">${dateNum}</span>`;
    headerGrid.appendChild(el);
  });

  /* ── Build time axis ── */
  const timeAxis = $('wk-time-axis');
  timeAxis.innerHTML = '';
  for (let h = WK_HOUR_START; h <= WK_HOUR_END; h++) {
    const label = document.createElement('div');
    label.className = 'wk-time-label';
    label.style.top = `${(h - WK_HOUR_START) * HPIX}px`;
    label.textContent = h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    timeAxis.appendChild(label);
  }

  /* ── Build body grid (day columns) ── */
  const bodyGrid = $('wk-body-grid');
  // Remove previous day columns (keep time axis)
  [...bodyGrid.querySelectorAll('.wk-day-col')].forEach(el => el.remove());

  const now = new Date();

  weekData.days.forEach(day => {
    const isToday = day.date === todayStr;
    const col     = document.createElement('div');
    col.className = `wk-day-col${isToday ? ' wk-today' : ''}`;

    /* Hour + half-hour lines */
    for (let h = 0; h < WK_HOURS; h++) {
      const line = document.createElement('div');
      line.className = 'wk-hour-line';
      line.style.top = `${h * HPIX}px`;
      col.appendChild(line);

      const half = document.createElement('div');
      half.className = 'wk-hour-line half';
      half.style.top = `${h * HPIX + HPIX / 2}px`;
      col.appendChild(half);
    }

    /* Booking blocks */
    day.bookings.forEach(b => {
      const start    = new Date(b.startTime);
      const end      = new Date(b.endTime);
      const startH   = start.getHours() + start.getMinutes() / 60;
      const endH     = end.getHours()   + end.getMinutes()   / 60;

      const clampedStart = Math.max(startH, WK_HOUR_START);
      const clampedEnd   = Math.min(endH,   WK_HOUR_END);
      if (clampedEnd <= clampedStart) return; // outside visible range

      const top    = (clampedStart - WK_HOUR_START) * HPIX;
      const height = Math.max((clampedEnd - clampedStart) * HPIX - 2, 18);

      const isOngoing = start <= now && end > now;
      const block = document.createElement('div');
      block.className = `wk-booking ${isOngoing ? 'wk-booking-ongoing' : 'wk-booking-booked'}`;
      block.style.top    = `${top}px`;
      block.style.height = `${height}px`;
      block.title        = `${b.title} · ${fmtTime(b.startTime)} – ${fmtTime(b.endTime)} · ${b.userName}`;

      let inner = `<div class="wk-booking-title">${b.title}</div>`;
      if (height >= 38) inner += `<div class="wk-booking-time">${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}</div>`;
      if (height >= 58) inner += `<div class="wk-booking-user">👤 ${b.userName}</div>`;
      block.innerHTML = inner;
      col.appendChild(block);
    });

    /* Current time line — today only */
    if (isToday) {
      const nowLine = buildNowLine(now);
      if (nowLine) col.appendChild(nowLine);
    }

    bodyGrid.appendChild(col);
  });

  /* Scroll to current time on today's week, or 8 AM otherwise */
  const scrollContainer = document.querySelector('.wk-body-scroll');
  if (scrollContainer) {
    let targetScroll = 0;
    if (weekOffset === 0) {
      const nowH = now.getHours() + now.getMinutes() / 60;
      const nowPx = (Math.max(nowH, WK_HOUR_START) - WK_HOUR_START) * HPIX;
      targetScroll = Math.max(0, nowPx - 80); // show a little before now
    }
    scrollContainer.scrollTop = targetScroll;
  }
}

/* Build the red "now" line element */
function buildNowLine(now) {
  const nowH = now.getHours() + now.getMinutes() / 60;
  if (nowH < WK_HOUR_START || nowH > WK_HOUR_END) return null;
  const HPIX = hourPx();
  const top  = (nowH - WK_HOUR_START) * HPIX;
  const line = document.createElement('div');
  line.className = 'wk-now-line';
  line.id        = 'wk-now-line';
  line.style.top = `${top}px`;
  line.innerHTML = '<div class="wk-now-dot"></div>';
  return line;
}

/* Update now-line position every clock tick (no full re-render) */
function updateNowLine() {
  const nowLine = document.getElementById('wk-now-line');
  if (!nowLine) return;
  const now  = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  if (nowH < WK_HOUR_START || nowH > WK_HOUR_END) return;
  const HPIX = hourPx();
  nowLine.style.top = `${(nowH - WK_HOUR_START) * HPIX}px`;
}

/* ── Socket.io ───────────────────────────────────────────── */
function connectSocket() {
  socket = io(CONFIG.socketUrl, { transports: ['websocket', 'polling'] });

  socket.on('connect',    () => console.log('[Socket] connected', socket.id));
  socket.on('disconnect', () => console.warn('[Socket] disconnected'));

  const onBookingEvent = () => {
    fetchData();
    if (isWeeklyView) fetchWeeklyData();
  };
  socket.on('booking:created',   onBookingEvent);
  socket.on('booking:updated',   onBookingEvent);
  socket.on('booking:cancelled', onBookingEvent);
}

/* ── Back to selector ──────────────────────────────────────── */
function goToSelector() {
  clearInterval(_clock);
  clearInterval(_refresh);
  clearInterval(_weekRefresh);
  if (socket) socket.disconnect();
  window.location.href = window.location.pathname;
}

/* ── Start ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
