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
const bcrypt         = require('bcryptjs');
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

const rawUserData = [
  { name: 'Monskie mon',  email: 'alice@company.com',  password: 'Admin1234!',  role: 'admin',    department: 'Engineering' },
  { name: 'Bob Smith',    email: 'bob@company.com',    password: 'Bob1234!',    role: 'employee', department: 'Design' },
  { name: 'Carol White',  email: 'carol@company.com',  password: 'Carol1234!',  role: 'employee', department: 'Management' },
  { name: 'David Lee',    email: 'david@company.com',  password: 'David1234!',  role: 'employee', department: 'Sales' },
  { name: 'Eve Chen',     email: 'eve@company.com',    password: 'Eve1234!',    role: 'guest',    department: 'HR' }
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

  // ── Users ──────────────────────────────────────────────
  const hashedUserData = await Promise.all(
    rawUserData.map(async (u) => ({
      ...u,
      password: await bcrypt.hash(u.password, 10)
    }))
  );
  const users = await User.insertMany(hashedUserData);
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



  console.log('\n✨ Seed complete! Summary:');
  console.log(`   Equipment:        ${equipment.length}`);
  console.log(`   Users:            ${users.length}`);
  console.log(`   Rooms:            ${rooms.length}`);
  console.log(`   Bookings:         0 (Removed)`);
  console.log(`   BookingRules:     2`);
  console.log(`   RecurringBookings: 0 (Removed)`);
  console.log(`   BookingLogs:      0 (Removed)`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
