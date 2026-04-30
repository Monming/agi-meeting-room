const mongoose = require('mongoose');

/**
 * Equipment Model
 * Named equipment items that can be referenced by rooms.
 */
const equipmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Equipment name is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['AV', 'Computing', 'Conferencing', 'Furniture', 'Other'],
    default: 'Other'
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

equipmentSchema.index({ name: 'text' });
equipmentSchema.index({ category: 1 });

module.exports = mongoose.model('Equipment', equipmentSchema);
