const mongoose = require('mongoose');

/**
 * BookingRules Model
 * Global (or per-room) policy configuration for bookings.
 * Singleton usage: roomId = null means global rules.
 */
const bookingRulesSchema = new mongoose.Schema({
  /** null = global rules; ObjectId = room-specific override */
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null
  },
  /** Maximum booking duration in minutes */
  maxDurationMinutes: {
    type: Number,
    default: 120,
    min: [15, 'Minimum duration is 15 minutes']
  },
  /** Buffer time required between consecutive bookings (minutes) */
  bufferMinutes: {
    type: Number,
    default: 10,
    min: 0
  },
  /** How many days in advance a room can be booked */
  maxAdvanceBookingDays: {
    type: Number,
    default: 30
  },
  /** Earliest hour bookings are allowed (24h, e.g. 8 = 8 AM) */
  allowedStartHour: {
    type: Number,
    default: 8
  },
  /** Latest hour bookings must end by (24h) */
  allowedEndHour: {
    type: Number,
    default: 20
  },
  /** Whether the same user can have overlapping bookings in different rooms */
  allowSameUserOverlap: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// One global rule + one override per room
bookingRulesSchema.index({ roomId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('BookingRules', bookingRulesSchema);
