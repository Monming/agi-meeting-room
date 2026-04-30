const mongoose = require('mongoose');

/**
 * Room Model (Production v2)
 *
 * Maintains backward compatibility:
 *   - amenities: [String]  → human-readable labels (used by frontend)
 *   - equipment: [ObjectId] → structured refs to Equipment collection
 *
 * Indexes:
 *   1. Text index on name            → autocomplete search
 *   2. { capacity: 1 }              → capacity filtering
 *   3. { status: 1, isActive: 1 }   → directory filtering
 */
const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Room name is required'],
    trim: true
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Capacity must be at least 1']
  },
  location: {
    type: String,
    default: 'Main Building',
    trim: true
  },
  floor: {
    type: String,
    default: 'Ground Floor'
  },
  /** Human-readable amenity labels (frontend display) */
  amenities: [{
    type: String,
    trim: true
  }],
  /** Structured equipment references (admin/reporting use) */
  equipment: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipment'
  }],
  images: [{
    type: String
  }],
  status: {
    type: Number,
    enum: [0, 1, 2, 3], // 0: Available, 1: Occupied, 2: Maintenance, 3: Reserved
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  /** Buffer time (minutes) required between consecutive bookings in this room */
  bufferMinutes: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// --- Indexes ---
roomSchema.index({ name: 'text' });                 // Text search
roomSchema.index({ capacity: 1 });                  // Capacity filter
roomSchema.index({ status: 1, isActive: 1 });       // Directory filter
roomSchema.index({ 'equipment': 1 });               // Equipment filter

// --- Pre-save Validation Middleware ---
roomSchema.pre('save', function (next) {
  if (this.capacity <= 0) {
    return next(new Error('Room capacity must be greater than 0'));
  }
  next();
});

module.exports = mongoose.model('Room', roomSchema);
