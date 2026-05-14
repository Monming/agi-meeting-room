const Room      = require('../models/Room');
const Booking   = require('../models/Booking');
const Equipment = require('../models/Equipment');

/**
 * POST /api/rooms/availability-by-timeslots
 * Body: { date, durationMinutes, capacity?, query? }
 *
 * Generates 30-min slots from 9AM–6PM for the given date.
 * For each slot: checks if at least one matching room is free
 * for the full slot window (start → start + durationMinutes).
 *
 * PERFORMANCE: single DB query for all bookings on the day;
 * all slot availability resolved in-memory.
 */
exports.getAvailabilityByTimeslots = async (req, res) => {
  try {
    const { date, durationMinutes, capacity, query } = req.body;

    if (!date || !durationMinutes) {
      return res.status(400).json({ error: 'date and durationMinutes are required' });
    }

    const durMs = parseInt(durationMinutes, 10) * 60 * 1000;
    if (isNaN(durMs) || durMs <= 0) {
      return res.status(400).json({ error: 'durationMinutes must be a positive integer' });
    }

    // ── Step 1: Fetch matching rooms ──────────────────────────────────
    const roomQuery = { isActive: true };
    if (capacity) {
      if (capacity === '30+') {
        roomQuery.capacity = { $gte: 30 };
      } else {
        roomQuery.capacity = parseInt(capacity, 10);
      }
    }
    if (query)    roomQuery.name = { $regex: query, $options: 'i' };

    const rooms = await Room.find(roomQuery).select('_id bufferMinutes').lean();
    if (rooms.length === 0) {
      // No rooms match filters — all slots unavailable
      return res.json({ slots: buildEmptySlots(date, durMs) });
    }

    const roomIds = rooms.map(r => r._id);

    // Build a quick lookup: roomId -> bufferMs
    const bufferMap = {};
    rooms.forEach(r => { bufferMap[r._id.toString()] = (r.bufferMinutes || 0) * 60 * 1000; });

    // ── Step 2: Single query — all confirmed bookings for this date ───
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay   = new Date(`${date}T23:59:59.999`);

    const bookings = await Booking.find({
      roomId: { $in: roomIds },
      status: 'confirmed',
      startTime: { $lt: endOfDay },
      endTime:   { $gt: startOfDay }
    }).select('roomId startTime endTime').lean();

    // ── Step 3: Generate 30-min slots 9AM → 6PM ───────────────────────
    const slots = [];
    const SLOT_STEP_MS = 30 * 60 * 1000; // 30 min increments
    const DAY_START_H  = 9;
    const DAY_END_H    = 18; // last slot must END by 18:00

    let cursor = new Date(`${date}T00:00:00`);
    cursor.setHours(DAY_START_H, 0, 0, 0);

    while (true) {
      const slotStart = new Date(cursor.getTime());
      const slotEnd   = new Date(cursor.getTime() + durMs);

      // Don't create slots that would run past 6 PM
      if (slotEnd.getHours() > DAY_END_H || (slotEnd.getHours() === DAY_END_H && slotEnd.getMinutes() > 0)) break;
      if (slotStart.getHours() >= DAY_END_H) break;

      // Check: is there at least one room free for [slotStart, slotEnd]?
      const available = rooms.some(room => {
        const roomIdStr = room._id.toString();
        const buf = bufferMap[roomIdStr] || 0;

        // A room is free if NONE of its bookings overlap [slotStart - buf, slotEnd + buf]
        const effectiveStart = new Date(slotStart.getTime() - buf);
        const effectiveEnd   = new Date(slotEnd.getTime() + buf);

        return !bookings.some(b => {
          if (b.roomId.toString() !== roomIdStr) return false;
          const bStart = new Date(b.startTime);
          const bEnd   = new Date(b.endTime);
          // Overlap: booking_start < effective_end AND booking_end > effective_start
          return bStart < effectiveEnd && bEnd > effectiveStart;
        });
      });

      // Format label
      const h = slotStart.getHours();
      const m = slotStart.getMinutes();
      const period = h < 12 ? 'AM' : 'PM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const label = `${displayH}:${String(m).padStart(2, '0')} ${period}`;

      slots.push({
        label,
        iso:    slotStart.toISOString(),
        endIso: slotEnd.toISOString(),
        available
      });

      cursor = new Date(cursor.getTime() + SLOT_STEP_MS);
    }

    res.json({ slots });
  } catch (error) {
    console.error('getAvailabilityByTimeslots error:', error);
    res.status(500).json({ error: 'Failed to compute timeslot availability' });
  }
};

/** Helper: return all slots marked unavailable (used when no rooms match filters) */
function buildEmptySlots(date, durMs) {
  const slots = [];
  const SLOT_STEP_MS = 30 * 60 * 1000;
  let cursor = new Date(`${date}T00:00:00`);
  cursor.setHours(9, 0, 0, 0);
  while (cursor.getHours() < 18) {
    const slotStart = new Date(cursor.getTime());
    const slotEnd   = new Date(cursor.getTime() + durMs);
    if (slotEnd.getHours() > 18 || (slotEnd.getHours() === 18 && slotEnd.getMinutes() > 0)) break;
    const h = slotStart.getHours(); const m = slotStart.getMinutes();
    const period = h < 12 ? 'AM' : 'PM'; const displayH = h % 12 === 0 ? 12 : h % 12;
    slots.push({ label: `${displayH}:${String(m).padStart(2,'0')} ${period}`, iso: slotStart.toISOString(), endIso: slotEnd.toISOString(), available: false });
    cursor = new Date(cursor.getTime() + SLOT_STEP_MS);
  }
  return slots;
}

/**
 * POST /api/rooms/available
 * Body: { date, startTime, endTime, capacity, searchQuery, equipment[] }
 *
 * Availability query — two-step:
 *   1. Filter rooms by capacity / search / equipment (index-backed)
 *   2. Exclude rooms that have a confirmed overlapping booking
 *
 * PERFORMANCE: Always bounds queries by date range. Uses lean() for reads.
 */
exports.getAvailableRooms = async (req, res) => {
  try {
    const { capacity, searchQuery, date, startTime, endTime, equipment } = req.body;

    // ── Step 1: Build Room filter ──────────────────────────────────────
    const roomQuery = { isActive: true };
    if (capacity) {
      if (capacity === '30+') {
        roomQuery.capacity = { $gte: 30 };
      } else {
        roomQuery.capacity = parseInt(capacity, 10);
      }
    }
    if (searchQuery) roomQuery.name = { $regex: searchQuery, $options: 'i' };

    // Filter by equipment ObjectId refs (must have ALL requested items)
    if (equipment && equipment.length > 0) {
      roomQuery.equipment = { $all: equipment };
    }

    const rooms = await Room.find(roomQuery)
      .populate('equipment', 'name category')
      .lean();

    // 2. If time range is given, filter out rooms with conflicts
    let availableRooms = rooms;
    if (startTime && endTime) {
      const reqStart = new Date(startTime);
      const reqEnd = new Date(endTime);

      const overlappingBookings = await Booking.find({
        roomId: { $in: rooms.map(r => r._id) },
        status: 'confirmed',
        // Overlap condition: new_start < existing_end AND new_end > existing_start
        startTime: { $lt: reqEnd },
        endTime: { $gt: reqStart }
      }).select('roomId').lean();

      const bookedRoomIds = new Set(overlappingBookings.map(b => b.roomId.toString()));
      availableRooms = rooms.filter(r => !bookedRoomIds.has(r._id.toString()));
    } else if (date) {
      // Return all rooms but indicate which are booked on that date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const dayBookings = await Booking.find({
        roomId: { $in: rooms.map(r => r._id) },
        status: 'confirmed',
        startTime: { $lt: endOfDay },
        endTime: { $gt: startOfDay }
      }).lean();

      const bookedRoomIds = new Set(dayBookings.map(b => b.roomId.toString()));
      availableRooms = rooms.filter(r => !bookedRoomIds.has(r._id.toString()));
    }

    res.json({
      rooms: availableRooms,
      count: availableRooms.length
    });
  } catch (error) {
    console.error('getAvailableRooms error:', error);
    res.status(500).json({ error: 'Failed to fetch available rooms' });
  }
};

/**
 * GET /api/rooms/density?month=YYYY-MM
 * Returns availability ratio per day for calendar density dots
 */
exports.getDensity = async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month query param required (YYYY-MM)' });

    const [year, mo] = month.split('-').map(Number);
    const startOfMonth = new Date(year, mo - 1, 1);
    const endOfMonth = new Date(year, mo, 0, 23, 59, 59, 999);

    const totalRooms = await Room.countDocuments({ isActive: true });
    if (totalRooms === 0) return res.json({ density: {} });

    // Get all confirmed bookings for the month
    const bookings = await Booking.find({
      status: 'confirmed',
      startTime: { $lt: endOfMonth },
      endTime: { $gt: startOfMonth }
    }).select('roomId startTime endTime').lean();

    // Build a map: date string -> Set of booked roomIds
    const bookedByDay = {};
    bookings.forEach(b => {
      const start = new Date(b.startTime);
      const end = new Date(b.endTime);
      const cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      while (cur <= end && cur <= endOfMonth) {
        const key = cur.toISOString().split('T')[0];
        if (!bookedByDay[key]) bookedByDay[key] = new Set();
        bookedByDay[key].add(b.roomId.toString());
        cur.setDate(cur.getDate() + 1);
      }
    });

    // Build density map: date -> { availableRatio, label }
    const density = {};
    Object.keys(bookedByDay).forEach(dateStr => {
      const bookedCount = bookedByDay[dateStr].size;
      const availableCount = totalRooms - bookedCount;
      const ratio = availableCount / totalRooms;
      let dot;
      if (availableCount === 0) dot = 'red';
      else if (ratio < 0.3) dot = 'yellow';
      else dot = 'green';
      density[dateStr] = { availableCount, totalRooms, ratio, dot };
    });

    res.json({ density, totalRooms });
  } catch (error) {
    console.error('getDensity error:', error);
    res.status(500).json({ error: 'Failed to get density data' });
  }
};

/**
 * GET /api/rooms/search?q=searchTerm
 * Returns matching room names for autocomplete
 */
exports.searchRooms = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) return res.json({ rooms: [] });

    const rooms = await Room.find({
      isActive: true,
      name: { $regex: q, $options: 'i' }
    }).select('_id name capacity location status').limit(10).lean();

    res.json({ rooms });
  } catch (error) {
    console.error('searchRooms error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

/**
 * GET /api/rooms/status
 * Returns all active rooms with a computed liveStatus:
 *   "ongoing"   — a booking is happening right now
 *   "upcoming"  — next booking starts within 4 hours
 *   "available" — no booking at the moment
 */
exports.getRoomStatus = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(now); endOfDay.setHours(23, 59, 59, 999);

    // Single query — all confirmed bookings for today
    const rooms = await Room.find({ isActive: true }).lean();
    const bookings = await Booking.find({
      roomId: { $in: rooms.map(r => r._id) },
      status: 'confirmed',
      startTime: { $lt: endOfDay },
      endTime: { $gt: startOfDay }
    }).select('roomId startTime endTime').lean();

    // Build a map: roomId -> bookings[]
    const bookingMap = {};
    bookings.forEach(b => {
      const key = b.roomId.toString();
      if (!bookingMap[key]) bookingMap[key] = [];
      bookingMap[key].push(b);
    });

    const roomsWithStatus = rooms.map(room => {
      const roomBookings = bookingMap[room._id.toString()] || [];
      let liveStatus = 'available';

      for (const b of roomBookings) {
        const start = new Date(b.startTime);
        const end   = new Date(b.endTime);
        if (start <= now && end >= now) {
          liveStatus = 'ongoing';
          break;
        }
        if (start > now) {
          liveStatus = 'upcoming';
          // don't break — a later booking might still be 'ongoing' (shouldn't happen, but safe)
        }
      }

      return { ...room, liveStatus };
    });

    res.json({ rooms: roomsWithStatus });
  } catch (error) {
    console.error('getRoomStatus error:', error);
    res.status(500).json({ error: 'Failed to get room status' });
  }
};

/**
 * GET /api/rooms
 * Returns all rooms for Directory page
 */
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true }).lean();
    res.json({ rooms });
  } catch (error) {
    console.error('getAllRooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
};

/**
 * POST /api/rooms (Admin)
 */
exports.createRoom = async (req, res) => {
  try {
    const room = new Room(req.body);
    await room.save();
    res.status(201).json({ room });
  } catch (error) {
    console.error('createRoom error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
};

/**
 * PUT /api/rooms/:id (Admin)
 */
exports.updateRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ room });
  } catch (error) {
    console.error('updateRoom error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
};

/**
 * DELETE /api/rooms/:id (Admin)
 */
exports.deleteRoom = async (req, res) => {
  try {
    await Room.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Room deactivated' });
  } catch (error) {
    console.error('deleteRoom error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
};

/**
 * GET /api/rooms/:id/kiosk  (no auth required)
 * Returns a single-request payload for the kiosk tablet:
 *   { room, status, currentBooking, nextBooking, serverTime, schedule }
 * `schedule` is confirmed bookings for this room in a rolling window (sorted):
 *   local midnight − 14 days through local midnight + 42 days (for weekly calendar navigation).
 */
exports.getKioskData = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .select('name capacity location floor amenities')
      .lean();
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const rangeStart = new Date(startOfDay);
    rangeStart.setDate(rangeStart.getDate() - 14);
    const rangeEnd = new Date(startOfDay);
    rangeEnd.setDate(rangeEnd.getDate() + 42);

    // Confirmed bookings overlapping the kiosk range (timeline + weekly navigator)
    const bookings = await Booking.find({
      roomId: req.params.id,
      status: 'confirmed',
      startTime: { $lt: rangeEnd },
      endTime: { $gt: rangeStart },
    })
      .select('title userName startTime endTime')
      .sort({ startTime: 1 })
      .lean();

    let status         = 'AVAILABLE';
    let currentBooking = null;
    let nextBooking    = null;

    for (const b of bookings) {
      const start = new Date(b.startTime);
      const end   = new Date(b.endTime);

      if (start <= now && end > now) {
        status         = 'ONGOING';
        currentBooking = b;
      } else if (start > now && !nextBooking) {
        nextBooking = b;
      }
    }

    if (status !== 'ONGOING' && nextBooking) status = 'UPCOMING';

    res.json({
      room,
      status,
      currentBooking,
      nextBooking,
      serverTime: now.toISOString(),
      schedule: bookings,
    });
  } catch (error) {
    console.error('getKioskData error:', error);
    res.status(500).json({ error: 'Failed to fetch kiosk data' });
  }
};
