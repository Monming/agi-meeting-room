# 📺 Meeting Room Kiosk

Standalone, lightweight display app for tablets mounted outside meeting rooms.  
**No framework. No build step. Pure HTML + CSS + JS.**

---

## 🚀 Quick Start

```bash
# From the project root
cd kiosk
npm start
```

The kiosk will be available at **http://localhost:4300**

---

## 🔗 URL Routes

| URL | Description |
|-----|-------------|
| `http://localhost:4300` | Room selector — tap a room to launch |
| `http://localhost:4300?roomId=<id>` | Direct kiosk display for a room |

### Get Room IDs
```bash
curl http://localhost:3000/api/rooms
```

---

## ⚙️ Configuration

Edit the top of `app.js`:

```js
const CONFIG = {
  apiUrl:    'http://localhost:3000/api',  // ← your backend URL
  socketUrl: 'http://localhost:3000',       // ← your socket server URL
  refresh:   30_000                         // auto-refresh in ms
};
```

For production (Render.com):
```js
apiUrl:    'https://agi-meeting-room1.onrender.com/api',
socketUrl: 'https://agi-meeting-room1.onrender.com',
```

---

## 🖥️ Display States

| State | Color | Meaning |
|-------|-------|---------|
| **AVAILABLE** | 🟢 Green | No current booking |
| **ONGOING** | 🔴 Red | Meeting in progress + live countdown |
| **UPCOMING** | 🟡 Amber | Room is free but next meeting starts soon |

---

## 📡 Real-Time Events

Listens to Socket.io events from the backend:
- `booking:created` → instant refresh
- `booking:updated` → instant refresh  
- `booking:cancelled` → instant refresh

Plus polls every 30 seconds as a safety fallback.

---

## 🖥️ Tablet Setup (Fullscreen)

1. Open the URL on the tablet browser
2. Press `F11` (or use browser fullscreen mode)
3. Use a kiosk browser app (e.g. **Fully Kiosk Browser** on Android) for production

### Serve from Backend (Optional)

You can serve the kiosk from the backend instead of a separate server.
In `backend/server.js`, add after the existing routes:

```js
const path = require('path');
app.use('/kiosk', express.static(path.join(__dirname, '../kiosk')));
```

Then access at: `http://localhost:3000/kiosk`
