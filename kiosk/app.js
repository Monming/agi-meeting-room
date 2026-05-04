/* ═══════════════════════════════════════════════════════════
   KIOSK APP — app.js
   Pure vanilla JS, no build step. CDN: Socket.io 4.x
   Routes:
     index.html            → room selector
     index.html?roomId=ID  → kiosk display for room ID
═══════════════════════════════════════════════════════════ */

/* ── CONFIG  (change to match your deployment) ─────────── */
const CONFIG = {
  apiUrl:    'http://localhost:3000/api',
  socketUrl: 'http://localhost:3000',
  refresh:   30_000   // 30 s poll interval
};

/* ── STATE ─────────────────────────────────────────────── */
let roomId   = null;
let data     = null;
let socket   = null;
let _clock   = null;   // setInterval handle — live clock
let _refresh = null;   // setInterval handle — data refresh

/* ── HELPERS ────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function fmtDuration(startIso, endIso) {
  const mins = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  return mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60 ? mins%60+'m' : ''}`.trim() : `${mins} min`;
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

  // Fetch statuses in parallel then render
  Promise.allSettled(
    rooms.map(r => fetch(`${CONFIG.apiUrl}/rooms/${r._id}/kiosk`).then(x => x.json()))
  ).then(results => {
    grid.innerHTML = '';
    rooms.forEach((room, i) => {
      const st = results[i].status === 'fulfilled' ? (results[i].value.status || 'AVAILABLE') : 'AVAILABLE';
      const card = document.createElement('div');
      card.className = 'room-card';
      card.innerHTML = `
        <div class="room-card-name">${room.name}</div>
        <div class="room-card-cap">👥 Capacity: ${room.capacity}</div>
        <span class="room-card-badge badge-${st.toLowerCase()}">${st}</span>
      `;
      card.addEventListener('click', () => {
        window.location.href = `?roomId=${room._id}`;
      });
      grid.appendChild(card);
    });
  });
}

/* ══ KIOSK MODE ══════════════════════════════════════════ */
function startKioskMode() {
  fetchData();

  // Live clock — tick every second
  _clock = setInterval(tickClock, 1000);
  tickClock();

  // Data auto-refresh — every 30 s
  _refresh = setInterval(fetchData, CONFIG.refresh);

  // Socket.io real-time
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
}

/* ── Data fetch ──────────────────────────────────────────── */
async function fetchData() {
  try {
    const res  = await fetch(`${CONFIG.apiUrl}/rooms/${roomId}/kiosk`);
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

/* ── Render ──────────────────────────────────────────────── */
function renderKiosk() {
  if (!data) return;

  /* Room meta */
  $('room-name').textContent   = data.room?.name || 'Unknown Room';
  $('room-detail').textContent = data.room?.capacity ? `👥 ${data.room.capacity} seats${data.room.floor ? '  ·  Floor ' + data.room.floor : ''}` : '';

  /* Status state class on screen */
  const screen = $('screen-kiosk');
  screen.classList.remove('state-available', 'state-ongoing', 'state-upcoming');
  screen.classList.add(`state-${data.status.toLowerCase()}`);

  /* Status badge */
  const labels = { AVAILABLE: '✓  Available', ONGOING: '●  In Use', UPCOMING: '◎  Reserved Soon' };
  $('status-badge').textContent = labels[data.status] || data.status;

  /* Cards */
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

  /* Next bar — shown when ONGOING and there is a next meeting */
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

/* ── Countdown (called every second by clock tick) ────────── */
function updateCountdown() {
  if (!data || data.status !== 'ONGOING' || !data.currentBooking) return;

  const diff = new Date(data.currentBooking.endTime).getTime() - Date.now();
  const el   = $('countdown-text');

  if (diff <= 0) {
    el.textContent = 'Ending…';
    // Data will be stale — refetch after 3 s
    setTimeout(fetchData, 3000);
    return;
  }

  const totalMins = Math.floor(diff / 60000);
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const secs = Math.floor((diff % 60000) / 1000);

  el.textContent = hrs > 0
    ? `${hrs}h ${mins}m remaining`
    : mins > 0
      ? `${mins}m ${secs}s remaining`
      : `${secs}s remaining`;

  // Turn red when under 5 minutes
  el.classList.toggle('urgent', totalMins < 5);
}

/* ── Socket.io ───────────────────────────────────────────── */
function connectSocket() {
  socket = io(CONFIG.socketUrl, { transports: ['websocket', 'polling'] });

  socket.on('connect',    () => console.log('[Socket] connected', socket.id));
  socket.on('disconnect', () => console.warn('[Socket] disconnected'));

  const refresh = () => fetchData();
  socket.on('booking:created',   refresh);
  socket.on('booking:updated',   refresh);
  socket.on('booking:cancelled', refresh);
}

/* ── Back to selector ──────────────────────────────────────── */
function goToSelector() {
  clearInterval(_clock);
  clearInterval(_refresh);
  if (socket) socket.disconnect();
  window.location.href = window.location.pathname;
}

/* ── Start ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
