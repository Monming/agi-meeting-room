const Booking = require('../models/Booking');

/**
 * detectConflict
 * ─────────────────────────────────────────────────────────────────────────
 * Core conflict detection for booking overlap.
 *
 * Implements the standard interval overlap test:
 *   (newStart < existingEnd) AND (newEnd > existingStart)
 *
 * With optional buffer time applied symmetrically:
 *   effectiveStart = newStart − bufferMs
 *   effectiveEnd   = newEnd   + bufferMs
 *
 * This means two adjacent bookings must have at least `bufferMinutes`
 * of gap between them.
 *
 * @param {string|ObjectId} roomId        - Room to check
 * @param {Date|string}     startTime     - Requested start time
 * @param {Date|string}     endTime       - Requested end time
 * @param {number}          bufferMinutes - Buffer gap required (default: 0)
 * @param {string|ObjectId} [excludeId]  - Booking ID to exclude (for updates)
 * @param {object}          [session]    - Mongoose session for transactions
 *
 * @returns {Promise<object|null>} Conflicting booking doc, or null if clear
 */
async function detectConflict(
  roomId,
  startTime,
  endTime,
  bufferMinutes = 0,
  excludeId = null,
  session = null
) {
  const bufferMs      = bufferMinutes * 60_000;
  const effectiveStart = new Date(new Date(startTime).getTime() - bufferMs);
  const effectiveEnd   = new Date(new Date(endTime).getTime()   + bufferMs);

  const query = {
    roomId,
    status: 'confirmed',
    startTime: { $lt: effectiveEnd   },  // existing starts before new ends
    endTime:   { $gt: effectiveStart  }  // existing ends   after  new starts
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const opts = session ? { session } : {};
  return Booking.findOne(query, null, opts).lean();
}

/**
 * detectUserOverlap
 * ─────────────────────────────────────────────────────────────────────────
 * Check if a user already has a booking at the requested time window
 * (across any room). Used when allowSameUserOverlap = false.
 *
 * @param {string|ObjectId} userId
 * @param {Date|string}     startTime
 * @param {Date|string}     endTime
 * @param {string|ObjectId} [excludeId]
 * @param {object}          [session]
 *
 * @returns {Promise<object|null>}
 */
async function detectUserOverlap(userId, startTime, endTime, excludeId = null, session = null) {
  const query = {
    userId,
    status: 'confirmed',
    startTime: { $lt: new Date(endTime)   },
    endTime:   { $gt: new Date(startTime) }
  };
  if (excludeId) query._id = { $ne: excludeId };

  const opts = session ? { session } : {};
  return Booking.findOne(query, null, opts).lean();
}

module.exports = { detectConflict, detectUserOverlap };
