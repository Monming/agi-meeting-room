const RecurringBooking = require('../models/RecurringBooking');
const { detectConflict } = require('./conflictDetection');

/**
 * expandRecurringBooking
 * ─────────────────────────────────────────────────────────────────────────
 * Generates individual Booking-compatible date ranges from a RecurringBooking rule.
 *
 * Each occurrence is returned as { startTime, endTime } — callers are
 * responsible for saving them as Booking documents (with conflict checking).
 *
 * @param {object} rule - RecurringBooking document
 * @returns {Array<{startTime: Date, endTime: Date}>}
 */
function expandRecurringBooking(rule) {
  const {
    recurrenceType, startTime, endTime, startDate, endDate
  } = rule;

  const occurrences = [];
  const startHour   = new Date(startTime).getUTCHours();
  const startMin    = new Date(startTime).getUTCMinutes();
  const endHour     = new Date(endTime).getUTCHours();
  const endMin      = new Date(endTime).getUTCMinutes();

  let cursor = new Date(startDate);
  cursor.setUTCHours(startHour, startMin, 0, 0);
  const limit = new Date(endDate);

  while (cursor <= limit) {
    const occStart = new Date(cursor);
    const occEnd   = new Date(cursor);
    occEnd.setUTCHours(endHour, endMin, 0, 0);

    occurrences.push({ startTime: occStart, endTime: occEnd });

    // Advance by recurrence period
    if (recurrenceType === 'daily') {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    } else if (recurrenceType === 'weekly') {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else if (recurrenceType === 'monthly') {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  return occurrences;
}

/**
 * previewRecurringConflicts
 * Returns a list of conflicts for each occurrence before any saves.
 *
 * @param {object} rule
 * @param {number} bufferMinutes
 * @returns {Promise<Array<{occurrence, conflict}>>}
 */
async function previewRecurringConflicts(rule, bufferMinutes = 0) {
  const occurrences = expandRecurringBooking(rule);
  const conflicts   = [];

  for (const occ of occurrences) {
    const conflict = await detectConflict(rule.roomId, occ.startTime, occ.endTime, bufferMinutes);
    if (conflict) {
      conflicts.push({ occurrence: occ, conflict });
    }
  }

  return conflicts;
}

module.exports = { expandRecurringBooking, previewRecurringConflicts };
