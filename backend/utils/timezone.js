/**
 * Client sends JavaScript Date#getTimezoneOffset() (minutes: UTC − local).
 * Converts between user's local calendar/wall-clock and UTC instants — no manual +8; offset is caller-supplied.
 */

function parseYmd(dateStr) {
  const [ys, mos, ds] = dateStr.split('-');
  return {
    y: parseInt(ys, 10),
    mo: parseInt(mos, 10),
    d: parseInt(ds, 10),
  };
}

function addCalendarDays(y, mo, d, deltaDays) {
  const x = new Date(Date.UTC(y, mo - 1, d));
  x.setUTCDate(x.getUTCDate() + deltaDays);
  return { y: x.getUTCFullYear(), mo: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

/** Wall-clock components in client's timezone → UTC ms. */
function localWallClockToUtcMs(y, mo, d, hour, minute, second, ms, tzOffsetMinutes) {
  return Date.UTC(y, mo - 1, d, hour, minute, second || 0, ms || 0) + tzOffsetMinutes * 60000;
}

/** UTC instant → client's local clock { hours, minutes }. */
function utcMsToLocalWallClock(utcMs, tzOffsetMinutes) {
  const shifted = utcMs - tzOffsetMinutes * 60000;
  const x = new Date(shifted);
  return { hours: x.getUTCHours(), minutes: x.getUTCMinutes() };
}

function readTzOffsetMinutes(body = {}) {
  const v = body.tzOffsetMinutes;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Query string ?tzOffsetMinutes=-480 → number or null if absent. */
function readTzOffsetFromQuery(query = {}) {
  if (query.tzOffsetMinutes === undefined || query.tzOffsetMinutes === '') return null;
  const v = parseInt(String(query.tzOffsetMinutes), 10);
  return Number.isFinite(v) ? v : null;
}

/** Calendar Y-M-D in the client's zone for "now" (uses offset only; same as typical mobile/desktop clock). */
function localCalendarYmdFromUtcNow(tzOffsetMinutes) {
  const t = Date.now() - tzOffsetMinutes * 60000;
  const d = new Date(t);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

module.exports = {
  parseYmd,
  addCalendarDays,
  localWallClockToUtcMs,
  utcMsToLocalWallClock,
  readTzOffsetMinutes,
  readTzOffsetFromQuery,
  localCalendarYmdFromUtcNow,
};
