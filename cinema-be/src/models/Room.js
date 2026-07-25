const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const roomSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    cinema_id: { type: Number, required: true, index: true },
    name: { type: String, required: true },
  },
  { timestamps: true },
);

withCleanJSON(roomSchema);

module.exports = mongoose.model('Room', roomSchema);
