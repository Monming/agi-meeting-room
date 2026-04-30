const Booking = require('../models/Booking');
const Room = require('../models/Room');

class BookingService {
  /**
   * Creates a new booking with a 10-minute buffer check.
   */
  async createBooking(bookingData) {
    const { roomId, startTime, endTime } = bookingData;
    
    // Ensure startTime and endTime are Date objects
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Buffer Time: 10 minutes (in milliseconds)
    const BUFFER_TIME_MS = 10 * 60 * 1000;

    // Calculate buffer times
    const startWithBuffer = new Date(start.getTime() - BUFFER_TIME_MS);
    const endWithBuffer = new Date(end.getTime() + BUFFER_TIME_MS);

    // Check for overlapping bookings with buffer
    const overlappingBookings = await Booking.find({
      roomId: roomId,
      $or: [
        // Existing booking ends after our requested start with buffer
        // AND existing booking starts before our requested end with buffer
        {
          startTime: { $lt: endWithBuffer },
          endTime: { $gt: startWithBuffer }
        }
      ]
    });

    if (overlappingBookings.length > 0) {
      throw new Error('Room is unavailable during this time. Please leave a 10-minute gap before and after other meetings.');
    }

    const booking = new Booking(bookingData);
    await booking.save();
    
    // Set room to Reserved status (3) if the booking is happening right now
    const now = new Date();
    if (now >= start && now <= end) {
      await Room.findByIdAndUpdate(roomId, { status: 3 });
    }

    return booking;
  }
  
  // Other standard CRUD operations can be added here
}

module.exports = new BookingService();
