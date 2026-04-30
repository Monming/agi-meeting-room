const BookingRules = require('../models/BookingRules');

/**
 * getRulesForRoom
 * Returns the effective BookingRules for a given room.
 * Falls back to global rules (roomId: null) if no room-specific override exists.
 *
 * @param {string|ObjectId|null} roomId
 * @returns {Promise<object>} rules document
 */
async function getRulesForRoom(roomId) {
  // 1. Try room-specific rule
  if (roomId) {
    const roomRule = await BookingRules.findOne({ roomId }).lean();
    if (roomRule) return roomRule;
  }
  // 2. Fall back to global rule
  const globalRule = await BookingRules.findOne({ roomId: null }).lean();
  if (globalRule) return globalRule;

  // 3. Return hard-coded defaults if no rules doc exists
  return {
    maxDurationMinutes:     120,
    bufferMinutes:          10,
    maxAdvanceBookingDays:  30,
    allowedStartHour:       8,
    allowedEndHour:         20,
    allowSameUserOverlap:   false
  };
}

/**
 * validateBookingAgainstRules
 * Validates a booking request against applicable BookingRules.
 * Returns an array of error strings (empty = valid).
 *
 * @param {object} params
 * @param {Date}   params.startTime
 * @param {Date}   params.endTime
 * @param {string|ObjectId} params.roomId
 * @returns {Promise<string[]>} validation errors
 */
async function validateBookingAgainstRules({ startTime, endTime, roomId }) {
  const rules  = await getRulesForRoom(roomId);
  const errors = [];
  const start  = new Date(startTime);
  const end    = new Date(endTime);
  const now    = new Date();

  // 1. Duration check
  const durationMins = (end - start) / 60_000;
  if (durationMins > rules.maxDurationMinutes) {
    errors.push(
      `Booking duration (${durationMins} min) exceeds maximum allowed (${rules.maxDurationMinutes} min)`
    );
  }

  // 2. Advance booking limit
  const advanceDays = (start - now) / 86_400_000;
  if (advanceDays > rules.maxAdvanceBookingDays) {
    errors.push(
      `Booking is too far in advance. Maximum is ${rules.maxAdvanceBookingDays} days`
    );
  }

  // 3. Allowed hours check
  const startHour = start.getHours();
  const endHour   = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
  if (startHour < rules.allowedStartHour) {
    errors.push(`Bookings cannot start before ${rules.allowedStartHour}:00`);
  }
  if (endHour > rules.allowedEndHour) {
    errors.push(`Bookings must end by ${rules.allowedEndHour}:00`);
  }

  // 4. Past booking check
  if (start < now) {
    errors.push('Cannot book a room in the past');
  }

  return errors;
}

module.exports = { getRulesForRoom, validateBookingAgainstRules };
