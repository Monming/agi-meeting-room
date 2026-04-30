# Meeting Room Reservation System

A full-stack meeting room booking application built with **Ionic Angular** + **Node.js/Express/MongoDB Atlas**.

## Quick Start

### 1. Start Backend
```bash
cd backend
npm start
# Server runs on http://localhost:3000
```

### 2. Start Frontend
```bash
cd frontend
npm start
# App runs on http://localhost:4200
```

### 3. Seed Database (first time only)
```bash
cd backend
npm run seed
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Ionic Angular 20, Tailwind CSS v4 |
| State | RxJS BehaviorSubject + switchMap |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB Atlas |
| Real-time | Socket.io |

## App Structure

```
meeting-room-reservation/
├── backend/
│   ├── models/         # Room.js, Booking.js
│   ├── routes/         # roomRoutes.js, bookingRoutes.js
│   ├── controllers/    # roomController.js, bookingController.js
│   ├── db/seed.js      # Database seed (10 rooms, 5 bookings)
│   ├── .env            # MONGO_URI, PORT
│   └── server.js       # Express + Socket.io entry point
│
└── frontend/
    └── src/app/
        ├── tabs/           # Tab shell + routing
        ├── home/           # Dashboard page
        ├── book/           # Booking page (calendar + smart filter)
        ├── directory/      # Room directory page
        ├── settings/       # Profile + admin page
        ├── components/     # Shared reusable components
        ├── services/       # room, booking, socket, booking-state
        └── models/types.ts # Shared TypeScript interfaces
```

## Pages

### 🏠 Home
- Today's schedule with meeting cards
- Available Now room carousel
- Quick Book CTA

### 📅 Book
- **Smart Filter**: Search → Capacity Chips → Date Picker → Time Slots
- Real-time available rooms counter
- Room list with **Book** button → Confirm modal
- Visual calendar with density markers

### 📋 Directory
- Search + capacity + status filters
- All rooms with amenity badges

### ⚙️ Settings
- Profile management
- Notification preferences
- Admin Panel (add/manage rooms)

## Environment

Backend `.env`:
```
PORT=3000
MONGO_URI=mongodb://...your-atlas-uri.../meeting-rooms
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/rooms` | List all rooms |
| POST | `/api/rooms/available` | Availability check |
| GET | `/api/rooms/search?q=` | Autocomplete |
| GET | `/api/rooms/density?month=` | Calendar markers |
| POST | `/api/rooms` | Create room |
| GET | `/api/bookings/today` | Today's bookings |
| GET | `/api/bookings/day?date=` | Day view |
| POST | `/api/bookings` | Create booking |
| DELETE | `/api/bookings/:id` | Cancel booking |
