const mongoose        = require('mongoose');
const Booking         = require('../models/Booking');
const Room            = require('../models/Room');
const Equipment       = require('../models/Equipment');
const BookingLog      = require('../models/BookingLog');
const RecurringBooking = require('../models/RecurringBooking');
const { detectConflict, detectUserOverlap } = require('../utils/conflictDetection');
const { validateBookingAgainstRules, getRulesForRoom } = require('../utils/bookingRulesValidator');
const { expandRecurringBooking, previewRecurringConflicts } = require('../utils/recurringBookingExpander');

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

    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(date); endOfDay.setHours(23, 59, 59, 999);

    const query = {
      status: 'confirmed',
      startTime: { $lt: endOfDay },
      endTime:   { $gt: startOfDay }
    };
    if (roomId) query.roomId = roomId;

    const bookings = await Booking.find(query)
      .populate('roomId', 'name capacity')
      .populate('userId', 'name email')
      .sort({ startTime: 1 })
      .lean();

    // Build 9AM–6PM hourly slots
    const slots = [];
    for (let hour = 9; hour <= 17; hour++) {
      const slotStart = new Date(date); slotStart.setHours(hour, 0, 0, 0);
      const slotEnd   = new Date(date); slotEnd.setHours(hour + 1, 0, 0, 0);

      const slotBookings = bookings.filter(b => {
        return new Date(b.startTime) < slotEnd && new Date(b.endTime) > slotStart;
      });

      slots.push({
        hour,
        label: hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`,
        status: slotBookings.length > 0 ? 'booked' : 'available',
        bookings: slotBookings.map(b => ({
          id:        b._id,
          title:     b.title,
          userName:  b.userName,
          roomName:  b.roomId?.name || '',
          startTime: b.startTime,
          endTime:   b.endTime
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
    const { userId } = req.query;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);

    const query = {
      status: 'confirmed',
      startTime: { $gte: startOfDay, $lte: endOfDay }
    };
    // Support both ObjectId userId and legacy string
    if (userId) query.userIdLegacy = userId;

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
   Body: { roomId, startTime, endTime, userId, userName, title }
   ─────────────────────────────────────────────────────────────
   Uses a MongoDB session/transaction to make the conflict check
   and insert atomic (prevents race conditions).
   ───────────────────────────────────────────────────────────── */
exports.createBooking = async (req, res) => {
  const { roomId, startTime, endTime, userId, userName, title } = req.body;

  if (!roomId || !startTime || !endTime) {
    return res.status(400).json({ error: 'roomId, startTime, endTime are required' });
  }

  const session = await mongoose.startSession();

  try {
    let booking;

    await session.withTransaction(async () => {

      // 1. Verify room exists
      const room = await Room.findById(roomId).lean().session(session);
      if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });

      // 2. Validate against BookingRules (duration, advance booking, hours)
      const ruleErrors = await validateBookingAgainstRules({ startTime, endTime, roomId });
      if (ruleErrors.length > 0) {
        throw Object.assign(new Error(ruleErrors.join('; ')), { status: 422 });
      }

      // 3. Conflict detection (atomic within transaction)
      const rules        = await getRulesForRoom(roomId);
      const bufferMins   = Math.max(room.bufferMinutes || 0, rules.bufferMinutes || 0);
      const conflict     = await detectConflict(roomId, startTime, endTime, bufferMins, null, session);

      if (conflict) {
        throw Object.assign(new Error('Time slot conflict detected'), {
          status: 409,
          conflictDetails: { existingStart: conflict.startTime, existingEnd: conflict.endTime }
        });
      }

      // 4. Resolve userId — accept ObjectId or legacy string
      let resolvedUserId = null;
      let resolvedLegacyId = null;
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        resolvedUserId = userId;
      } else if (userId) {
        resolvedLegacyId = userId; // legacy 'user-001' style
      }

      // 5. Create booking document
      [booking] = await Booking.create([{
        roomId,
        userId:      resolvedUserId,
        userIdLegacy: resolvedLegacyId,
        userName:    userName || 'User',
        title:       title || 'Meeting',
        startTime:   new Date(startTime),
        endTime:     new Date(endTime),
        status:      'confirmed'
      }], { session });

      // 6. Write audit log (within transaction)
      await writeLog(booking._id, 'created', resolvedUserId, { roomId, startTime, endTime, title }, session);
    });

    // 7. Populate for response (outside transaction — read-only)
    await booking.populate('roomId', 'name capacity location');

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
   DELETE /api/bookings/:id
   ───────────────────────────────────────────────────────────── */
exports.cancelBooking = async (req, res) => {
  try {
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
   Body: { roomId, userId, recurrenceType, startTime, endTime,
           startDate, endDate, title }
   Generates all individual Booking documents from the rule.
   ───────────────────────────────────────────────────────────── */
exports.createRecurringBooking = async (req, res) => {
  try {
    const { roomId, userId, recurrenceType, startTime, endTime, startDate, endDate, title } = req.body;

    if (!roomId || !recurrenceType || !startTime || !endTime || !startDate || !endDate) {
      return res.status(400).json({ error: 'roomId, recurrenceType, startTime, endTime, startDate, endDate required' });
    }

    const room = await Room.findById(roomId).lean();
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Save the RecurringBooking rule first
    const rule = await RecurringBooking.create({
      roomId, userId, recurrenceType, startTime, endTime,
      startDate, endDate, title: title || 'Recurring Meeting',
      isActive: true
    });

    // Preview all conflicts before committing
    const rules       = await getRulesForRoom(roomId);
    const bufferMins  = Math.max(room.bufferMinutes || 0, rules.bufferMinutes || 0);
    const conflicts   = await previewRecurringConflicts(rule, bufferMins);

    if (conflicts.length > 0) {
      await RecurringBooking.findByIdAndDelete(rule._id); // rollback rule
      return res.status(409).json({
        error: `${conflicts.length} occurrence(s) have conflicts`,
        conflicts: conflicts.map(c => ({
          occurrence: c.occurrence,
          conflictWith: { start: c.conflict.startTime, end: c.conflict.endTime }
        }))
      });
    }

    // Generate all occurrence bookings
    const occurrences    = expandRecurringBooking(rule);
    const resolvedUserId = userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null;
    const legacyId       = !resolvedUserId ? userId : null;

    const bookingDocs = occurrences.map(occ => ({
      roomId,
      userId:             resolvedUserId,
      userIdLegacy:       legacyId,
      userName:           req.body.userName || 'User',
      title:              title || 'Recurring Meeting',
      startTime:          occ.startTime,
      endTime:            occ.endTime,
      status:             'confirmed',
      isRecurring:        true,
      recurringBookingId: rule._id
    }));

    const created = await Booking.insertMany(bookingDocs);

    // Log each
    for (const b of created) {
      await writeLog(b._id, 'recurring_generated', resolvedUserId, { recurringBookingId: rule._id });
    }

    if (req.io) req.io.emit('booking:recurring_created', { count: created.length, recurringBookingId: rule._id });

    res.status(201).json({
      recurringBooking: rule,
      bookingsCreated: created.length,
      firstOccurrence: created[0]?.startTime,
      lastOccurrence:  created[created.length - 1]?.startTime
    });
  } catch (err) {
    console.error('createRecurringBooking error:', err);
    res.status(500).json({ error: 'Failed to create recurring booking' });
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
