const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Equipment = require('../models/Equipment');
const BookingLog = require('../models/BookingLog');
const RecurringBooking = require('../models/RecurringBooking');
const { detectConflict, detectUserOverlap } = require('../utils/conflictDetection');
const { validateBookingAgainstRules, getRulesForRoom } = require('../utils/bookingRulesValidator');
const { expandRecurringBooking, previewRecurringConflicts } = require('../utils/recurringBookingExpander');
const {
  parseYmd,
  addCalendarDays,
  localWallClockToUtcMs,
  readTzOffsetMinutes,
  readTzOffsetFromQuery,
  localCalendarYmdFromUtcNow,
} = require('../utils/timezone');

/* ─────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────── */

/** Write an audit log entry (non-blocking — errors are swallowed) */
async function writeLog(bookingId, action, userId, metadata = {}, session = null) {
  try {
    const opts = session ? { session } : {};
    await BookingLog.create([{ bookingId, action, userId, metadata }], opts);
  } catch (e) {
    console.error('[BookingLog] Failed to write log:', e.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   GET /api/bookings/day?date=YYYY-MM-DD[&roomId=]
   ───────────────────────────────────────────────────────────── */
exports.getDaySchedule = async (req, res) => {
  try {
    const { date, roomId } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });

    const tzQ = readTzOffsetFromQuery(req.query);
    const tzOffsetMinutes = tzQ !== null ? tzQ : 0;
    const { y, mo, d } = parseYmd(date);
    const dayStartUtcMs = localWallClockToUtcMs(y, mo, d, 0, 0, 0, 0, tzOffsetMinutes);
    const nd = addCalendarDays(y, mo, d, 1);
    const nextMidnightUtcMs = localWallClockToUtcMs(nd.y, nd.mo, nd.d, 0, 0, 0, 0, tzOffsetMinutes);
    const startOfDay = new Date(dayStartUtcMs);
    const endExclusive = new Date(nextMidnightUtcMs);

    const query = {
      status: 'confirmed',
      startTime: { $lt: endExclusive },
      endTime: { $gt: startOfDay }
    };
    if (roomId) query.roomId = roomId;

    const bookings = await Booking.find(query)
      .populate('roomId', 'name capacity')
      .populate('userId', 'name email')
      .sort({ startTime: 1 })
      .lean();

    // Build 9AM–6PM hourly slots (client-local hours; compares UTC correctly)
    const slots = [];
    for (let hour = 9; hour <= 17; hour++) {
      const slotStart = new Date(localWallClockToUtcMs(y, mo, d, hour, 0, 0, 0, tzOffsetMinutes));
      const slotEnd = new Date(localWallClockToUtcMs(y, mo, d, hour + 1, 0, 0, 0, tzOffsetMinutes));

      const slotBookings = bookings.filter(b => {
        return new Date(b.startTime) < slotEnd && new Date(b.endTime) > slotStart;
      });

      slots.push({
        hour,
        label: hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`,
        status: slotBookings.length > 0 ? 'booked' : 'available',
        bookings: slotBookings.map(b => ({
          id: b._id,
          title: b.title,
          userName: b.userName,
          roomName: b.roomId?.name || '',
          startTime: b.startTime,
          endTime: b.endTime
        }))
      });
    }

    res.json({ date, slots });
  } catch (err) {
    console.error('getDaySchedule error:', err);
    res.status(500).json({ error: 'Failed to get day schedule' });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/bookings/today[?userId=]
   ───────────────────────────────────────────────────────────── */
exports.getTodayBookings = async (req, res) => {
  try {
    if (!req.user?.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(401).json({ error: 'Invalid authenticated user' });
    }

    const tzQ = readTzOffsetFromQuery(req.query);

    let startTimeRange;
    if (tzQ !== null && Number.isFinite(tzQ)) {
      const { y, mo, d } = localCalendarYmdFromUtcNow(tzQ);
      const dayStartUtcMs = localWallClockToUtcMs(y, mo, d, 0, 0, 0, 0, tzQ);
      const nd = addCalendarDays(y, mo, d, 1);
      const nextMidnightUtcMs = localWallClockToUtcMs(nd.y, nd.mo, nd.d, 0, 0, 0, 0, tzQ);
      startTimeRange = {
        $gte: new Date(dayStartUtcMs),
        $lt: new Date(nextMidnightUtcMs)
      };
    } else {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      startTimeRange = { $gte: startOfDay, $lte: endOfDay };
    }

    const query = {
      status: 'confirmed',
      startTime: startTimeRange,
      userId: new mongoose.Types.ObjectId(req.user.id)
    };

    const bookings = await Booking.find(query)
      .populate('roomId', 'name capacity location floor amenities')
      .populate('userId', 'name email')
      .sort({ startTime: 1 })
      .lean();

    res.json({ bookings });
  } catch (err) {
    console.error('getTodayBookings error:', err);
    res.status(500).json({ error: 'Failed to get today bookings' });
  }
};

/* ─────────────────────────────────────────────────────────────
   POST /api/bookings
   Body: { roomId, startTime, endTime, title? }
   userId / userName from JWT only (never from client body).
   ─────────────────────────────────────────────────────────────
   Uses a MongoDB session/transaction to make the conflict check
   and insert atomic (prevents race conditions).
   ───────────────────────────────────────────────────────────── */
exports.createBooking = async (req, res) => {
  const { roomId, startTime, endTime, title } = req.body;
  const tzOffsetMinutes = readTzOffsetMinutes(req.body);
  const authUserId = req.user.id;
  const userName = req.user.name || 'User';

  if (!roomId || !startTime || !endTime) {
    return res.status(400).json({ error: 'roomId, startTime, endTime are required' });
  }

  if (!mongoose.Types.ObjectId.isValid(authUserId)) {
    return res.status(401).json({ error: 'Invalid authenticated user' });
  }
  const resolvedUserId = new mongoose.Types.ObjectId(authUserId);

  if (process.env.BOOKING_TZ_DEBUG === '1') {
    console.log('[booking/create]', {
      tzOffsetMinutes,
      startTimeUtc: new Date(startTime).toISOString(),
      endTimeUtc: new Date(endTime).toISOString(),
    });
  }

  const session = await mongoose.startSession();

  try {
    let booking;

    await session.withTransaction(async () => {

      // 1. Verify room exists
      const room = await Room.findById(roomId).lean().session(session);
      if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });

      // 2. Validate against BookingRules (opening hours interpreted in client's local zone)
      const ruleErrors = await validateBookingAgainstRules({
        startTime,
        endTime,
        roomId,
        tzOffsetMinutes
      });
      if (ruleErrors.length > 0) {
        throw Object.assign(new Error(ruleErrors.join('; ')), { status: 422 });
      }

      // 3. Conflict detection (atomic within transaction)
      const rules = await getRulesForRoom(roomId);
      const bufferMins = Math.max(room.bufferMinutes || 0, rules.bufferMinutes || 0);
      const conflict = await detectConflict(roomId, startTime, endTime, bufferMins, null, session);

      if (conflict) {
        throw Object.assign(new Error('Time slot conflict detected'), {
          status: 409,
          conflictDetails: { existingStart: conflict.startTime, existingEnd: conflict.endTime }
        });
      }

      // 4. Create booking document (owner = authenticated user only)
      [booking] = await Booking.create([{
        roomId,
        userId: resolvedUserId,
        userIdLegacy: null,
        userName: userName,
        title: title || 'Meeting',
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: 'confirmed'
      }], { session });

      // 6. Write audit log (within transaction)
      await writeLog(booking._id, 'created', resolvedUserId, { roomId, startTime, endTime, title }, session);
    });

    // 7. Populate for response (outside transaction — read-only)
    await booking.populate([
      { path: 'roomId', select: 'name capacity location floor amenities' },
      { path: 'userId', select: 'name email' }
    ]);

    // 8. Real-time notification
    if (req.io) req.io.emit('booking:created', { booking });

    res.status(201).json({ booking });

  } catch (err) {
    console.error('createBooking error:', err);
    const status = err.status || 500;
    const payload = { error: err.message };
    if (err.conflictDetails) payload.conflictDetails = err.conflictDetails;
    res.status(status).json(payload);
  } finally {
    session.endSession();
  }
};

/* ─────────────────────────────────────────────────────────────
   PUT /api/bookings/:id
   Body: { startTime, endTime, roomId?, title? }
   ───────────────────────────────────────────────────────────── */
exports.updateBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { startTime, endTime, roomId: newRoomId, title } = req.body;
    const tzOffsetMinutes = readTzOffsetMinutes(req.body);

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime are required' });
    }

    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);
    const now = new Date();

    if (newEnd <= newStart) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    let updatedBooking;

    await session.withTransaction(async () => {
      // 1. Load booking
      const booking = await Booking.findById(id).session(session);
      if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

      // 2. RBAC — owner or admin only
      const isOwner = booking.userId && booking.userId.toString() === req.user.id;
      const isAdmin = req.user.role === 'admin';
      if (!isOwner && !isAdmin) {
        throw Object.assign(new Error('Access denied. You do not own this booking.'), { status: 403 });
      }

      // 3. Guard: cannot edit a booking that has already ended
      if (new Date(booking.endTime) < now) {
        throw Object.assign(new Error('Cannot edit a booking that has already ended.'), { status: 400 });
      }

      // 4. Guard: cannot edit within 5 minutes of start
      const minsUntilStart = (new Date(booking.startTime) - now) / 60000;
      if (minsUntilStart < 5 && minsUntilStart > 0) {
        throw Object.assign(new Error('Cannot edit a booking within 5 minutes of its start time.'), { status: 400 });
      }

      // 5. Resolve target roomId
      const targetRoomId = newRoomId || booking.roomId;

      // 6. Verify room exists
      const room = await Room.findById(targetRoomId).lean().session(session);
      if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });

      // 7. Conflict detection — exclude this booking itself
      const bufferMins = room.bufferMinutes || 0;
      const conflict = await detectConflict(targetRoomId, newStart, newEnd, bufferMins, id, session);
      if (conflict) {
        const fmt = d => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        throw Object.assign(
          new Error(`Time slot conflict with an existing booking (${fmt(conflict.startTime)} – ${fmt(conflict.endTime)})`),
          { status: 409, conflictDetails: { existingStart: conflict.startTime, existingEnd: conflict.endTime } }
        );
      }

      // 7b. Booking rules (client-local opening hours)
      const ruleErrors = await validateBookingAgainstRules({
        startTime: newStart,
        endTime: newEnd,
        roomId: targetRoomId,
        tzOffsetMinutes
      });
      if (ruleErrors.length > 0) {
        throw Object.assign(new Error(ruleErrors.join('; ')), { status: 422 });
      }

      // 8. Apply changes
      booking.startTime = newStart;
      booking.endTime = newEnd;
      booking.roomId = targetRoomId;
      if (title !== undefined) booking.title = title;

      await booking.save({ session });

      // 9. Audit log
      await writeLog(booking._id, 'updated', req.user.id, {
        startTime: newStart, endTime: newEnd, roomId: targetRoomId, title
      }, session);

      updatedBooking = booking;
    });

    // 10. Populate for response
    await updatedBooking.populate([
      { path: 'roomId', select: 'name capacity location floor' },
      { path: 'userId', select: 'name email' }
    ]);

    // 11. Real-time broadcast
    if (req.io) req.io.emit('booking:updated', { booking: updatedBooking });

    res.json({ booking: updatedBooking });

  } catch (err) {
    console.error('updateBooking error:', err);
    const status = err.status || 500;
    const payload = { error: err.message };
    if (err.conflictDetails) payload.conflictDetails = err.conflictDetails;
    res.status(status).json(payload);
  } finally {
    session.endSession();
  }
};

/* ─────────────────────────────────────────────────────────────
   DELETE /api/bookings/:id
   ───────────────────────────────────────────────────────────── */
exports.cancelBooking = async (req, res) => {
  try {
    const bookingToCancel = await Booking.findById(req.params.id);
    if (!bookingToCancel) return res.status(404).json({ error: 'Booking not found' });

    if (bookingToCancel.userId && bookingToCancel.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. You do not own this booking.' });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    await writeLog(booking._id, 'cancelled', booking.userId, { reason: req.body.reason });

    if (req.io) req.io.emit('booking:cancelled', { bookingId: req.params.id });

    res.json({ message: 'Booking cancelled', booking });
  } catch (err) {
    console.error('cancelBooking error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
};

/* ─────────────────────────────────────────────────────────────
   PATCH /api/bookings/:id/checkin
   ───────────────────────────────────────────────────────────── */
exports.checkIn = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { isCheckedIn: true },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    await writeLog(booking._id, 'checkin', booking.userId);

    res.json({ booking });
  } catch (err) {
    console.error('checkIn error:', err);
    res.status(500).json({ error: 'Failed to check in' });
  }
};

/* ─────────────────────────────────────────────────────────────
   POST /api/bookings/recurring
   Body: {
     roomId, title,
     startTime,       ← time-of-day ISO (date portion ignored)
     endTime,         ← time-of-day ISO
     startDate,       ← first occurrence date
     endDate,         ← last occurrence date (inclusive)
     recurrenceType,  ← "daily" | "weekly" | "custom"
     daysOfWeek,      ← [0-6] required for "custom", optional for "weekly"
     skipConflicts    ← if true, skip conflicting dates instead of rejecting
   }
   ───────────────────────────────────────────────────────────── */
exports.createRecurringBooking = async (req, res) => {
  try {
    const {
      roomId, recurrenceType, startTime, endTime,
      startDate, endDate, title, daysOfWeek, skipConflicts
    } = req.body;
    const tzOffsetMinutes = readTzOffsetMinutes(req.body);
    const userId = req.user.id;
    const userName = req.user.name || 'User';

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ error: 'Invalid authenticated user' });
    }

    // Validate required fields
    if (!roomId || !recurrenceType || !startTime || !endTime || !startDate || !endDate) {
      return res.status(400).json({ error: 'roomId, recurrenceType, startTime, endTime, startDate, endDate are required' });
    }
    if (recurrenceType === 'custom' && (!daysOfWeek || daysOfWeek.length === 0)) {
      return res.status(400).json({ error: 'daysOfWeek is required for custom recurrence type' });
    }

    const room = await Room.findById(roomId).lean();
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Save the RecurringBooking rule
    const rule = await RecurringBooking.create({
      roomId, userId, recurrenceType,
      daysOfWeek: daysOfWeek || [],
      startTime, endTime, startDate, endDate,
      title: title || 'Recurring Meeting',
      isActive: true
    });

    // Calculate buffer time
    const rules = await getRulesForRoom(roomId);
    const bufferMins = Math.max(room.bufferMinutes || 0, rules.bufferMinutes || 0);

    // Preview conflicts for all occurrences
    const allOccurrences = expandRecurringBooking(rule);
    const skipped = [];
    const toCreate = [];

    for (const occ of allOccurrences) {
      const conflict = await detectConflict(roomId, occ.startTime, occ.endTime, bufferMins);
      if (conflict) {
        skipped.push({
          date: occ.startTime.toISOString().split('T')[0],
          conflictWith: { start: conflict.startTime, end: conflict.endTime }
        });
      } else {
        toCreate.push(occ);
      }
    }

    // If skipConflicts=false (default), reject if any conflicts exist
    if (!skipConflicts && skipped.length > 0) {
      await RecurringBooking.findByIdAndDelete(rule._id);
      return res.status(409).json({
        error: `${skipped.length} occurrence(s) have conflicts. Set skipConflicts=true to skip them automatically.`,
        skipped
      });
    }

    // If nothing to create, rollback
    if (toCreate.length === 0) {
      await RecurringBooking.findByIdAndDelete(rule._id);
      return res.status(409).json({
        error: 'All occurrences have conflicts. No bookings were created.',
        skipped
      });
    }

    for (const occ of toCreate) {
      const ruleErrors = await validateBookingAgainstRules({
        startTime: occ.startTime,
        endTime: occ.endTime,
        roomId,
        tzOffsetMinutes
      });
      if (ruleErrors.length > 0) {
        await RecurringBooking.findByIdAndDelete(rule._id);
        return res.status(422).json({ error: ruleErrors.join('; ') });
      }
    }

    // Create all non-conflicting bookings (owner = JWT user only)
    const resolvedUserId = new mongoose.Types.ObjectId(userId);

    const bookingDocs = toCreate.map(occ => ({
      roomId,
      userId: resolvedUserId,
      userName,
      title: title || 'Recurring Meeting',
      startTime: occ.startTime,
      endTime: occ.endTime,
      status: 'confirmed',
      isRecurring: true,
      recurringBookingId: rule._id
    }));

    const created = await Booking.insertMany(bookingDocs);

    // Write audit logs
    for (const b of created) {
      await writeLog(b._id, 'recurring_generated', resolvedUserId, { recurringBookingId: rule._id });
    }

    if (req.io) req.io.emit('booking:recurring_created', { count: created.length, recurringBookingId: rule._id });

    res.status(201).json({
      recurringBookingId: rule._id,
      recurrenceType: rule.recurrenceType,
      daysOfWeek: rule.daysOfWeek,
      bookingsCreated: created.length,
      skippedConflicts: skipped.length,
      skipped,
      firstOccurrence: created[0]?.startTime,
      lastOccurrence: created[created.length - 1]?.startTime
    });
  } catch (err) {
    console.error('createRecurringBooking error:', err);
    res.status(500).json({ error: 'Failed to create recurring booking' });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/bookings/week
   Returns all confirmed bookings for the current Mon–Sun week,
   grouped by date.
   ───────────────────────────────────────────────────────────── */
exports.getWeeklyBookings = async (req, res) => {
  try {
    const now = new Date();

    // Compute Monday of current week (ISO week starts Monday)
    const day = now.getDay(); // 0=Sun, 1=Mon...6=Sat
    const diffToMonday = (day === 0) ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    // Sunday = Monday + 6
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const bookings = await Booking.find({
      status: 'confirmed',
      startTime: { $gte: weekStart, $lte: weekEnd }
    })
      .populate('roomId', 'name')
      .populate('userId', 'name')
      .sort({ startTime: 1 })
      .lean();

    // Build a map for each day of the week
    const result = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);

      const dateStr = dayDate.toISOString().split('T')[0];
      const dayBookings = bookings.filter(b => {
        return new Date(b.startTime).toISOString().split('T')[0] === dateStr;
      });

      result.push({
        date: dateStr,
        bookings: dayBookings.map(b => ({
          _id: b._id,
          roomId: b.roomId?._id || b.roomId,
          roomName: b.roomId?.name || 'Unknown Room',
          title: b.title || 'Meeting',
          userName: b.userName || b.userId?.name || 'Unknown',
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          isRecurring: b.isRecurring || false
        }))
      });
    }

    res.json({ week: result });
  } catch (err) {
    console.error('getWeeklyBookings error:', err);
    res.status(500).json({ error: 'Failed to get weekly bookings' });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/bookings/rules[?roomId=]
   ───────────────────────────────────────────────────────────── */
exports.getBookingRules = async (req, res) => {
  try {
    const rules = await getRulesForRoom(req.query.roomId || null);
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get booking rules' });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/bookings/kiosk-week   (PUBLIC — no auth)
   Query: roomId=xxx  startDate=YYYY-MM-DD (optional, defaults to current week)
   Returns weekly bookings for the kiosk display.
   ───────────────────────────────────────────────────────────── */
exports.getKioskWeeklyBookings = async (req, res) => {
  try {
    const { roomId, startDate } = req.query;

    /* Compute Monday of the requested week */
    let weekStart;
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      const { y, mo, d } = parseYmd(startDate);
      // Find the Monday on or before this date
      const given = new Date(y, mo - 1, d, 0, 0, 0, 0);
      const dow = given.getDay(); // 0=Sun
      const diff = dow === 0 ? -6 : 1 - dow;
      weekStart = new Date(given);
      weekStart.setDate(given.getDate() + diff);
    } else {
      const now = new Date();
      const dow = now.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      weekStart = new Date(now);
      weekStart.setDate(now.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const query = {
      status: 'confirmed',
      startTime: { $gte: weekStart, $lte: weekEnd }
    };
    if (roomId) query.roomId = roomId;

    const bookings = await Booking.find(query)
      .populate('userId', 'name')
      .sort({ startTime: 1 })
      .lean();

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const days = [];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);   
      dayDate.setDate(weekStart.getDate() + i);
      const dateStr = dayDate.toISOString().split('T')[0];

      const dayBookings = bookings.filter(b => {
        return new Date(b.startTime).toISOString().split('T')[0] === dateStr;
      });

      days.push({
        date: dateStr,
        bookings: dayBookings.map(b => ({
          _id: b._id,
          title: b.title || 'Meeting',
          userName: b.userName || b.userId?.name || 'Unknown',
          startTime: b.startTime,
          endTime: b.endTime,
          isRecurring: b.isRecurring || false
        }))
      });
    }

    res.json({ weekStart: weekStartStr, days });
  } catch (err) {
    console.error('getKioskWeeklyBookings error:', err);
    res.status(500).json({ error: 'Failed to get kiosk weekly bookings' });
  }
};