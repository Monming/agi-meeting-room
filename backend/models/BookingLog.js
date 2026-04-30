const mongoose = require('mongoose');

/**
 * BookingLog Model
 * Immutable audit trail for all booking actions.
 * TTL index auto-deletes logs after 90 days.
 */
const bookingLogSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  action: {
    type: String,
    enum: ['created', 'cancelled', 'updated', 'checkin', 'auto_cancelled', 'recurring_generated'],
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  /** Freeform context metadata (before/after states, reason, etc.) */
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL: auto-delete after 90 days (90 * 24 * 3600 = 7,776,000 seconds)
bookingLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7_776_000 });
bookingLogSchema.index({ bookingId: 1 });
bookingLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('BookingLog', bookingLogSchema);
