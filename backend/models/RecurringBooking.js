const mongoose = require('mongoose');

/**
 * RecurringBooking Model
 * Defines a recurrence rule; individual Booking documents are generated from this.
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
    enum: ['daily', 'weekly', 'monthly'],
    required: [true, 'recurrenceType is required']
  },
  /** Time-of-day start (date portion is ignored; only HH:mm matters) */
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
