/**
 * seed.js — Production Database Seed
 * ─────────────────────────────────────────────────────────────────────────
 * Populates all collections with realistic reference data:
 *   • Equipment  (8 items across 4 categories)
 *   • Users      (1 admin + 4 regular users)
 *   • BookingRules (1 global + 2 room-specific overrides)
 *   • Rooms      (10 rooms with equipment refs + amenity labels)
 *   • Bookings   (today's schedule + upcoming meetings)
 *
 * Usage:
 *   node db/seed.js
 *   npm run seed
 */
'use strict';

require('dotenv').config();
const mongoose       = require('mongoose');
const Equipment      = require('../models/Equipment');
const User           = require('../models/User');
const Room           = require('../models/Room');
const Booking        = require('../models/Booking');
const BookingRules   = require('../models/BookingRules');
const RecurringBooking = require('../models/RecurringBooking');
const BookingLog     = require('../models/BookingLog');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/meeting-rooms';

/* ─────────────────────────────────────────────────────────────
   SEED DATA DEFINITIONS
   ───────────────────────────────────────────────────────────── */

const equipmentData = [
  { name: 'TV Screen',           category: 'AV',           description: '65" 4K smart display' },
  { name: 'Projector',           category: 'AV',           description: 'Ceiling-mounted 4K projector' },
  { name: 'Whiteboard',          category: 'Other',        description: 'Standard dry-erase whiteboard' },
  { name: 'Video Conferencing',  category: 'Conferencing', description: 'Zoom/Teams certified endpoint' },
  { name: 'Microphone Array',    category: 'Conferencing', description: 'Omnidirectional ceiling mic' },
  { name: 'Laptop Stand',        category: 'Furniture',    description: 'Adjustable presenter stand' },
  { name: 'HDMI Hub',            category: 'Computing',    description: '4-port HDMI switch box' },
  { name: 'Digital Whiteboard',  category: 'AV',           description: 'Interactive touch display board' }
];

const userData = [
  { name: 'Monskie mon',  email: 'alice@company.com',  role: 'admin',  department: 'Engineering' },
  { name: 'Bob Smith',      email: 'bob@company.com',    role: 'user',   department: 'Design' },
  { name: 'Carol White',    email: 'carol@company.com',  role: 'user',   department: 'Management' },
  { name: 'David Lee',      email: 'david@company.com',  role: 'user',   department: 'Sales' },
  { name: 'Eve Chen',       email: 'eve@company.com',    role: 'user',   department: 'HR' }
];

/* ─────────────────────────────────────────────────────────────
   MAIN SEED FUNCTION
   ───────────────────────────────────────────────────────────── */
async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // ── Wipe existing data ─────────────────────────────────────
  await Promise.all([
    Equipment.deleteMany({}),
    User.deleteMany({}),
    Room.deleteMany({}),
    Booking.deleteMany({}),
    BookingRules.deleteMany({}),
    RecurringBooking.deleteMany({}),
    BookingLog.deleteMany({})
  ]);
  console.log('🗑️  Cleared all collections');

  // ── Equipment ──────────────────────────────────────────────
  const equipment = await Equipment.insertMany(equipmentData);
  const eq = Object.fromEntries(equipment.map(e => [e.name, e._id]));
  console.log(`📦 Inserted ${equipment.length} equipment items`);

  // ── Users ──────────────────────────────────────────────────
  const users = await User.insertMany(userData);
  const [alice, bob, carol, david, eve] = users;
  console.log(`👤 Inserted ${users.length} users`);

  // ── BookingRules ───────────────────────────────────────────
  await BookingRules.create([
    {
      // Global rule (roomId: null)
      roomId:               null,
      maxDurationMinutes:   120,
      bufferMinutes:        10,
      maxAdvanceBookingDays: 30,
      allowedStartHour:     8,
      allowedEndHour:       20,
      allowSameUserOverlap: false
    }
  ]);
  console.log('⚙️  Inserted global BookingRules');

  // ── Rooms ──────────────────────────────────────────────────
  const roomData = [
    {
      name: 'Alpha Room',
      capacity: 10,
      location: 'Building A', floor: '1st Floor',
      amenities: ['TV Screen', 'Whiteboard', 'Video Conferencing'],
      equipment: [eq['TV Screen'], eq['Whiteboard'], eq['Video Conferencing']],
      bufferMinutes: 15
    },
    {
      name: 'Beta Room',
      capacity: 15,
      location: 'Building A', floor: '2nd Floor',
      amenities: ['Projector', 'Whiteboard', 'HDMI Hub'],
      equipment: [eq['Projector'], eq['Whiteboard'], eq['HDMI Hub']],
      bufferMinutes: 10
    },
    {
      name: 'Gamma Room',
      capacity: 20,
      location: 'Building B', floor: '1st Floor',
      amenities: ['TV Screen', 'Video Conferencing', 'Microphone Array'],
      equipment: [eq['TV Screen'], eq['Video Conferencing'], eq['Microphone Array']],
      bufferMinutes: 15
    },
    {
      name: 'Delta Room',
      capacity: 30,
      location: 'Building B', floor: '3rd Floor',
      amenities: ['Projector', 'Video Conferencing', 'Microphone Array', 'Whiteboard'],
      equipment: [eq['Projector'], eq['Video Conferencing'], eq['Microphone Array'], eq['Whiteboard']],
      bufferMinutes: 20
    },
    {
      name: 'AV Suite 1',
      capacity: 10,
      location: 'Building C', floor: 'Ground Floor',
      amenities: ['TV Screen', 'Video Conferencing', 'HDMI Hub'],
      equipment: [eq['TV Screen'], eq['Video Conferencing'], eq['HDMI Hub']],
      bufferMinutes: 10
    },
    {
      name: 'AV Suite 2',
      capacity: 15,
      location: 'Building C', floor: 'Ground Floor',
      status: 1, // Occupied
      amenities: ['TV Screen', 'Video Conferencing', 'Microphone Array'],
      equipment: [eq['TV Screen'], eq['Video Conferencing'], eq['Microphone Array']],
      bufferMinutes: 10
    },
    {
      name: 'Boardroom',
      capacity: 30,
      location: 'Building A', floor: '4th Floor',
      amenities: ['Digital Whiteboard', 'Video Conferencing', 'Microphone Array', 'Projector'],
      equipment: [eq['Digital Whiteboard'], eq['Video Conferencing'], eq['Microphone Array'], eq['Projector']],
      bufferMinutes: 30
    },
    {
      name: 'Focus Room 1',
      capacity: 10,
      location: 'Building D', floor: '1st Floor',
      amenities: ['TV Screen', 'Whiteboard'],
      equipment: [eq['TV Screen'], eq['Whiteboard']],
      bufferMinutes: 5
    },
    {
      name: 'Focus Room 2',
      capacity: 10,
      location: 'Building D', floor: '2nd Floor',
      status: 2, // Maintenance
      amenities: ['TV Screen', 'Whiteboard'],
      equipment: [eq['TV Screen'], eq['Whiteboard']],
      bufferMinutes: 5
    },
    {
      name: 'Training Hall',
      capacity: 30,
      location: 'Building E', floor: 'Ground Floor',
      amenities: ['Projector', 'Microphone Array', 'Whiteboard', 'Laptop Stand'],
      equipment: [eq['Projector'], eq['Microphone Array'], eq['Whiteboard'], eq['Laptop Stand']],
      bufferMinutes: 30
    }
  ];

  const rooms = await Room.insertMany(roomData);
  console.log(`🏢 Inserted ${rooms.length} rooms`);

  // ── Room-specific BookingRules overrides ───────────────────
  // Boardroom: max 2h meeting, 30min buffer
  await BookingRules.create({
    roomId:             rooms[6]._id, // Boardroom
    maxDurationMinutes: 120,
    bufferMinutes:      30,
    maxAdvanceBookingDays: 60
  });
  console.log('⚙️  Inserted Boardroom-specific BookingRules');

  // ── Today's Bookings ───────────────────────────────────────
  const today = new Date();
  const d = (h, m = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m);

  const bookingData = [
    {
      roomId: rooms[0]._id,         // Alpha Room
      userId: alice._id,
      userIdLegacy: 'user-001',
      userName: alice.name,
      title: 'Sprint Planning',
      startTime: d(9), endTime: d(10),
      status: 'confirmed'
    },
    {
      roomId: rooms[1]._id,         // Beta Room
      userId: bob._id,
      userIdLegacy: 'user-002',
      userName: bob.name,
      title: 'Design Review',
      startTime: d(11), endTime: d(12),
      status: 'confirmed'
    },
    {
      roomId: rooms[3]._id,         // Delta Room
      userId: alice._id,
      userIdLegacy: 'user-001',
      userName: alice.name,
      title: 'Client Presentation',
      startTime: d(14), endTime: d(15, 30),
      status: 'confirmed'
    },
    {
      roomId: rooms[6]._id,         // Boardroom
      userId: carol._id,
      userIdLegacy: 'user-003',
      userName: carol.name,
      title: 'Board Meeting',
      startTime: d(13), endTime: d(14),
      status: 'confirmed'
    },
    {
      roomId: rooms[4]._id,         // AV Suite 1
      userId: bob._id,
      userIdLegacy: 'user-002',
      userName: bob.name,
      title: 'Team Sync',
      startTime: d(16), endTime: d(17),
      status: 'confirmed'
    }
  ];

  const bookings = await Booking.insertMany(bookingData);
  console.log(`📅 Inserted ${bookings.length} today's bookings`);

  // ── Write BookingLog entries for seeded bookings ───────────
  const logEntries = bookings.map(b => ({
    bookingId: b._id,
    action:    'created',
    userId:    b.userId,
    metadata:  { source: 'seed' }
  }));
  await BookingLog.insertMany(logEntries);
  console.log(`📋 Inserted ${logEntries.length} audit log entries`);

  // ── Weekly Recurring Booking example ──────────────────────
  const nextMonday = new Date();
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
  nextMonday.setHours(10, 0, 0, 0);

  const recurringEndDate = new Date(nextMonday);
  recurringEndDate.setMonth(recurringEndDate.getMonth() + 2);

  const startTimeRule = new Date(); startTimeRule.setUTCHours(10, 0, 0, 0);
  const endTimeRule   = new Date(); endTimeRule.setUTCHours(11, 0, 0, 0);

  await RecurringBooking.create({
    userId:         alice._id,
    roomId:         rooms[0]._id,  // Alpha Room
    title:          'Weekly Engineering Standup',
    recurrenceType: 'weekly',
    startTime:      startTimeRule,
    endTime:        endTimeRule,
    startDate:      nextMonday,
    endDate:        recurringEndDate,
    isActive:       true
  });
  console.log('🔁 Inserted 1 RecurringBooking rule');

  console.log('\n✨ Seed complete! Summary:');
  console.log(`   Equipment:        ${equipment.length}`);
  console.log(`   Users:            ${users.length}`);
  console.log(`   Rooms:            ${rooms.length}`);
  console.log(`   Bookings:         ${bookings.length}`);
  console.log(`   BookingRules:     2`);
  console.log(`   RecurringBookings: 1`);
  console.log(`   BookingLogs:      ${logEntries.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
