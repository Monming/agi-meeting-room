const mongoose = require('mongoose');

/**
 * Booking Model (Production v2)
 *
 * Core booking record with:
 *   - Proper ObjectId reference to User (userId as ObjectId)
 *   - Backward-compatible userName string field
 *   - Compound index for O(log n) conflict detection
 *   - Link to RecurringBooking parent if generated from a recurrence rule
 *
 * Indexes:
 *   1. { roomId:1, startTime:1, endTime:1 } → conflict detection (CRITICAL)
 *   2. { startTime:1, endTime:1 }           → time range queries
 *   3. { userId:1, startTime:1 }            → user schedule
 *   4. { status:1 }                         → filter confirmed/cancelled
 */
const bookingSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'roomId is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  /** Legacy string fallback — kept for backward compatibility with frontend */
  userIdLegacy: {
    type: String,
    default: null
  },
  userName: {
    type: String,
    default: 'Unknown User'
  },
  title: {
    type: String,
    default: 'Meeting',
    trim: true
  },
  startTime: {
    type: Date,
    required: [true, 'startTime is required']
  },
  endTime: {
    type: Date,
    required: [true, 'endTime is required']
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'completed'],
    default: 'confirmed'
  },
  isCheckedIn: {
    type: Boolean,
    default: false
  },
  /** Reference to the RecurringBooking rule that generated this booking */
  recurringBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecurringBooking',
    default: null
  },
  isRecurring: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// --- CRITICAL: Compound index for O(log n) conflict detection ---
bookingSchema.index({ roomId: 1, startTime: 1, endTime: 1 });

// --- Supporting indexes ---
bookingSchema.index({ startTime: 1, endTime: 1 });
bookingSchema.index({ userId: 1, startTime: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ recurringBookingId: 1 });

// --- Pre-save Validation Middleware ---
bookingSchema.pre('save', function (next) {
  if (this.endTime <= this.startTime) {
    return next(new Error('endTime must be after startTime'));
  }
  const durationMs = this.endTime - this.startTime;
  const durationMins = durationMs / 60000;
  if (durationMins < 15) {
    return next(new Error('Minimum booking duration is 15 minutes'));
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
