# Meeting room kiosk (vanilla)

Served static files: open `index.html` or `index.html?roomId=<your MongoDB room id>`.

- **Rooms list:** `GET /api/rooms` (same as before)
- **Kiosk payload:** `GET /api/rooms/:id/kiosk` — returns `room`, `status`, `currentBooking`, `nextBooking`, `serverTime`, and **`schedule`** (confirmed bookings in a **~8 week window** around today for the weekly grid and timeline, sorted)

**UI:** **Live view** shows the status hero and today/tomorrow list. **Weekly** shows a Sun–Sat calendar (8am–6pm) with week navigation and a live “now” line when the visible week includes today. **Select room** returns to the room list.

Configure API base in `app.js` (`CONFIG.apiUrl` / `CONFIG.socketUrl`). Default assumes backend at `http://localhost:3000`.

```bash
npm run dev
```

Then open `http://localhost:4300` and pick a room, or pass `?roomId=...` directly.

No build step — UI is `index.html`, `app.css`, and `app.js` only.
