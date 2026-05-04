const { detectConflict } = require('./conflictDetection');

/**
 * expandRecurringBooking
 * ─────────────────────────────────────────────────────────────────────────
 * Generates individual {startTime, endTime} occurrences from a RecurringBooking rule.
 *
 * Supports:
 *   - "daily"  → every day from startDate to endDate
 *   - "weekly" → same weekday every week (uses daysOfWeek[0] or derives from startDate)
 *   - "custom" → only on specified days of week (daysOfWeek array)
 *
 * @param {object} rule - RecurringBooking document (plain object or Mongoose doc)
 * @returns {Array<{startTime: Date, endTime: Date}>}
 */
function expandRecurringBooking(rule) {
  const { recurrenceType, startTime, endTime, startDate, endDate, daysOfWeek } = rule;

  const startTimeDate = new Date(startTime);
  const endTimeDate   = new Date(endTime);

  // Extract time-of-day in UTC
  const startHour = startTimeDate.getUTCHours();
  const startMin  = startTimeDate.getUTCMinutes();
  const endHour   = endTimeDate.getUTCHours();
  const endMin    = endTimeDate.getUTCMinutes();

  const occurrences = [];
  const limit       = new Date(endDate);
  limit.setUTCHours(23, 59, 59, 999);

  // Determine which days-of-week to include
  let activeDays; // Set of 0–6 (Sun=0)
  if (recurrenceType === 'daily') {
    // All 7 days
    activeDays = new Set([0, 1, 2, 3, 4, 5, 6]);
  } else if (recurrenceType === 'weekly') {
    // Derive from startDate if daysOfWeek not set
    const d = daysOfWeek && daysOfWeek.length > 0
      ? daysOfWeek[0]
      : new Date(startDate).getUTCDay();
    activeDays = new Set([d]);
  } else if (recurrenceType === 'custom') {
    if (!daysOfWeek || daysOfWeek.length === 0) {
      throw new Error('daysOfWeek is required for custom recurrence type');
    }
    activeDays = new Set(daysOfWeek);
  } else {
    throw new Error(`Unknown recurrenceType: ${recurrenceType}`);
  }

  // Walk day by day from startDate to endDate
  let cursor = new Date(startDate);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= limit) {
    const dayOfWeek = cursor.getUTCDay();

    if (activeDays.has(dayOfWeek)) {
      const occStart = new Date(cursor);
      occStart.setUTCHours(startHour, startMin, 0, 0);

      const occEnd = new Date(cursor);
      occEnd.setUTCHours(endHour, endMin, 0, 0);

      occurrences.push({ startTime: occStart, endTime: occEnd });
    }

    // Advance by 1 day
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return occurrences;
}

/**
 * previewRecurringConflicts
 * ─────────────────────────────────────────────────────────────────────────
 * Dry-run: checks each occurrence for conflicts WITHOUT saving anything.
 * Returns an array of { occurrence, conflict } for any conflicting slots.
 *
 * @param {object} rule - RecurringBooking document
 * @param {number} bufferMinutes - Buffer time around bookings
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
