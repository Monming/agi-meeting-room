require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const RecurringBooking = require('../models/RecurringBooking');
const BookingLog = require('../models/BookingLog');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/meeting-rooms';

async function clearBookings() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const bookingResult = await Booking.deleteMany({});
    const recurringResult = await RecurringBooking.deleteMany({});
    const logResult = await BookingLog.deleteMany({});

    console.log(`🗑️ Cleared ${bookingResult.deletedCount} bookings.`);
    console.log(`🗑️ Cleared ${recurringResult.deletedCount} recurring rules.`);
    console.log(`🗑️ Cleared ${logResult.deletedCount} logs.`);
    
    console.log('✨ Your schedule is now completely empty!');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing bookings:', err);
    process.exit(1);
  }
}

clearBookings();
