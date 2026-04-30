const cron = require('node-cron');
const Booking = require('../models/Booking');
const Room = require('../models/Room');

/**
 * Auto-Release Logic
 * Runs every minute to check if any booking is 10 minutes past its startTime 
 * and the user has not checked in. If so, updates the room status back to 0 (Available).
 */
const startAutoReleaseJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      console.log('Running auto-release check...');
      
      const now = new Date();
      // Calculate the time 10 minutes ago
      const tenMinutesAgo = new Date(now.getTime() - (10 * 60 * 1000));

      // Find all bookings that:
      // - Haven't been checked into
      // - Started more than 10 minutes ago (startTime <= tenMinutesAgo)
      // - End time hasn't passed yet (still supposedly ongoing)
      const missedBookings = await Booking.find({
        isCheckedIn: false,
        startTime: { $lte: tenMinutesAgo },
        endTime: { $gt: now }
      });

      for (const booking of missedBookings) {
        console.log(`Auto-releasing room ${booking.roomId} for missed booking ${booking._id}`);
        
        // Update the room status to 0 (Available)
        await Room.findByIdAndUpdate(booking.roomId, { status: 0 });
        
        // Optionally, update the booking status to cancelled or similar 
        // if your schema tracks cancellation, or delete it, or mark it as no-show.
        // For this requirement, we mainly need to release the room.
      }
      
    } catch (error) {
      console.error('Error in auto-release cron job:', error);
    }
  });
};

module.exports = { startAutoReleaseJob };
