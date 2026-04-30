/**
 * queries.js — Production Query Examples
 * ─────────────────────────────────────────────────────────────────────────
 * Reference implementations for all core database operations.
 *
 * Usage: node db/queries.js
 */
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const Room     = require('../models/Room');
const Booking  = require('../models/Booking');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/meeting-rooms';

/* ═══════════════════════════════════════════════════════════════════════════
   1. AVAILABILITY QUERY
   Find rooms that:
     • Are active and have capacity >= requested
     • Have NO confirmed overlapping booking for the given time window
   ═══════════════════════════════════════════════════════════════════════════ */
async function queryAvailableRooms({ minCapacity, startTime, endTime, equipment = [] }) {
  console.log('\n── [1] Availability Query ──────────────────────────────────');
  console.log(`   Capacity: ≥${minCapacity} | Window: ${startTime} → ${endTime}`);

  // Step A: Build room filter
  const roomFilter = { isActive: true, capacity: { $gte: minCapacity } };
  if (equipment.length > 0) roomFilter.equipment = { $all: equipment };

  const candidates = await Room.find(roomFilter).select('_id name capacity').lean();
  const candidateIds = candidates.map(r => r._id);

  // Step B: Find rooms with overlapping bookings (conflict query)
  const conflictingRoomIds = await Booking.distinct('roomId', {
    roomId: { $in: candidateIds },
    status: 'confirmed',
    startTime: { $lt: new Date(endTime)   },   // existing starts before new ends
    endTime:   { $gt: new Date(startTime) }    // existing ends   after  new starts
  });

  const conflictSet = new Set(conflictingRoomIds.map(id => id.toString()));

  // Step C: Filter out conflicted rooms
  const available = candidates.filter(r => !conflictSet.has(r._id.toString()));

  console.log(`   Candidates: ${candidates.length} | Conflicts: ${conflictingRoomIds.length} | Available: ${available.length}`);
  available.forEach(r => console.log(`     • ${r.name} (cap: ${r.capacity})`));
  return available;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. CONFLICT DETECTION
   The canonical check — inline version for documentation.
   See utils/conflictDetection.js for the production utility.
   ═══════════════════════════════════════════════════════════════════════════ */
async function queryConflictDetection({ roomId, startTime, endTime, bufferMinutes = 0 }) {
  console.log('\n── [2] Conflict Detection ──────────────────────────────────');
  console.log(`   Room: ${roomId} | Buffer: ${bufferMinutes}min`);

  const bufferMs       = bufferMinutes * 60_000;
  const effectiveStart = new Date(new Date(startTime).getTime() - bufferMs);
  const effectiveEnd   = new Date(new Date(endTime).getTime()   + bufferMs);

  /*
   * Condition: (newStart < existingEnd) AND (newEnd > existingStart)
   * Expressed as:
   *   startTime: { $lt: effectiveEnd }   — existing start is before the new slot ends
   *   endTime:   { $gt: effectiveStart } — existing end   is after  the new slot starts
   */
  const conflict = await Booking.findOne({
    roomId,
    status: 'confirmed',
    startTime: { $lt: effectiveEnd   },
    endTime:   { $gt: effectiveStart }
  }).populate('userId', 'name').lean();

  if (conflict) {
    console.log(`   ⚠️  CONFLICT: "${conflict.title}" ${conflict.startTime} → ${conflict.endTime}`);
  } else {
    console.log('   ✅ No conflict — slot is clear');
  }

  return conflict;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. MONTHLY DENSITY AGGREGATION
   Groups bookings by calendar day and counts distinct booked rooms.
   Returns density labels (green/yellow/red) for calendar UI.
   ═══════════════════════════════════════════════════════════════════════════ */
async function queryMonthlyDensity(monthStr) {
  console.log(`\n── [3] Monthly Density — ${monthStr} ────────────────────────`);

  const [year, mo]    = monthStr.split('-').map(Number);
  const startOfMonth  = new Date(year, mo - 1, 1);
  const endOfMonth    = new Date(year, mo,     0, 23, 59, 59, 999);

  const totalRooms = await Room.countDocuments({ isActive: true });

  /*
   * Aggregation pipeline:
   *   1. $match — constrain to month (uses compound index)
   *   2. $group — project booking onto each calendar day it spans
   *   3. $group — count distinct rooms per day
   */
  const pipeline = [
    {
      $match: {
        status:    'confirmed',
        startTime: { $lt: endOfMonth   },
        endTime:   { $gt: startOfMonth }
      }
    },
    {
      // Project each booking as a day-string (simple case: use startTime day)
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$startTime' }
        },
        bookedRooms: { $addToSet: '$roomId' },
        bookingCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id:          0,
        date:         '$_id',
        bookingCount: 1,
        bookedRoomCount: { $size: '$bookedRooms' }
      }
    },
    { $sort: { date: 1 } }
  ];

  const results = await Booking.aggregate(pipeline);

  const density = {};
  results.forEach(({ date, bookingCount, bookedRoomCount }) => {
    const ratio = (totalRooms - bookedRoomCount) / totalRooms;
    const dot   = bookedRoomCount >= totalRooms ? 'red'
                : ratio < 0.3                  ? 'yellow'
                :                                'green';
    density[date] = { bookingCount, bookedRoomCount, totalRooms, dot };
    console.log(`   ${date}: ${bookingCount} bookings | ${bookedRoomCount}/${totalRooms} rooms booked | ${dot}`);
  });

  return density;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. USER SCHEDULE QUERY
   Fetch all confirmed bookings for a user in a date range.
   ═══════════════════════════════════════════════════════════════════════════ */
async function queryUserSchedule(userId, startDate, endDate) {
  console.log('\n── [4] User Schedule Query ─────────────────────────────────');

  return Booking.find({
    userId,
    status:    'confirmed',
    startTime: { $gte: new Date(startDate) },
    endTime:   { $lte: new Date(endDate)   }
  })
    .populate('roomId', 'name capacity location')
    .sort({ startTime: 1 })
    .lean();
}

/* ═══════════════════════════════════════════════════════════════════════════
   RUNNER
   ═══════════════════════════════════════════════════════════════════════════ */
async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  const month = today.substring(0, 7);

  // 1. Availability for next hour
  const slotStart = new Date(now.getTime() + 60_000 * 30);
  const slotEnd   = new Date(slotStart.getTime() + 60_000 * 60);
  await queryAvailableRooms({ minCapacity: 10, startTime: slotStart, endTime: slotEnd });

  // 2. Conflict check for Alpha Room
  const firstRoom = await Room.findOne({ name: 'Alpha Room' }).lean();
  if (firstRoom) {
    await queryConflictDetection({
      roomId:        firstRoom._id,
      startTime:     slotStart,
      endTime:       slotEnd,
      bufferMinutes: 15
    });
  }

  // 3. Monthly density
  await queryMonthlyDensity(month);

  await mongoose.disconnect();
  console.log('\n✅ Query examples complete');
}

run().catch(err => {
  console.error('Query error:', err);
  process.exit(1);
});
