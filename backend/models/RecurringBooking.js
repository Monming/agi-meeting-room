const mongoose = require('mongoose');

/**
 * RecurringBooking Model
 * Defines a recurrence rule; individual Booking documents are generated from this.
 *
 * recurrenceType:
 *   "daily"   → every day between startDate and endDate
 *   "weekly"  → same weekday every week
 *   "custom"  → specific days of week (daysOfWeek: [0=Sun,1=Mon,...,6=Sat])
 */
const recurringBookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'userId is required']
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'roomId is required']
  },
  title: {
    type: String,
    default: 'Recurring Meeting'
  },
  recurrenceType: {
    type: String,
    enum: ['daily', 'weekly', 'custom'],
    required: [true, 'recurrenceType is required']
  },
  /**
   * For "custom" type: array of day-of-week integers.
   * 0 = Sunday, 1 = Monday, ..., 6 = Saturday
   * For "weekly": automatically set to [dayOfWeek of startDate]
   */
  daysOfWeek: {
    type: [Number],
    default: []
  },
  /** Time-of-day start (only HH:mm is used; date portion is ignored) */
  startTime: {
    type: Date,
    required: true
  },
  /** Time-of-day end */
  endTime: {
    type: Date,
    required: true
  },
  /** First occurrence date */
  startDate: {
    type: Date,
    required: true
  },
  /** Last occurrence date (inclusive) */
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

recurringBookingSchema.index({ userId: 1 });
recurringBookingSchema.index({ roomId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('RecurringBooking', recurringBookingSchema);
