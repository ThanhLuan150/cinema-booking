const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const shiftSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    start_time: { type: String, required: true }, // HH:mm
    end_time: { type: String, required: true }, // HH:mm — may be <= start_time for an overnight shift (e.g. 16:00-00:00)
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true },
);

withCleanJSON(shiftSchema);

module.exports = mongoose.model('Shift', shiftSchema);
