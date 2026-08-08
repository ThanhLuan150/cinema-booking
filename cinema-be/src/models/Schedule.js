const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const scheduleSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    movie_id: { type: Number, required: true, index: true },
    room_id: { type: Number, required: true, index: true },
    cinema_id: { type: Number, index: true }, // denormalized from room_id's Room.cinema_id (the "branch")
    movie_date: { type: String, required: true }, // YYYY-MM-DD
    time_begin: { type: String, required: true }, // HH:mm
    time_end: { type: String, required: true },
    price: { type: Number, required: true },
    status: { type: String, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

withCleanJSON(scheduleSchema);

module.exports = mongoose.model('Schedule', scheduleSchema);
