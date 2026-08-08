const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const movieActorSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    movie_id: { type: Number, required: true, index: true },
    actor_id: { type: Number, required: true, index: true },
    character_name: { type: String, default: '' },
    is_lead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

withCleanJSON(movieActorSchema);

module.exports = mongoose.model('MovieActor', movieActorSchema);
