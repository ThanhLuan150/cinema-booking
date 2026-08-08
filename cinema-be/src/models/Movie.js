const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const movieSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    owner_id: { type: Number, default: null, index: true }, // account that added this movie; null = seeded/legacy
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '' },
    premiere_date: { type: String, required: true },
    description: { type: String, default: '' },
    country: { type: String, default: '' },
    trailer: { type: String, default: '' },
    producer: { type: String, default: '' },
    producerAvatar: { type: String, default: '' },
    // Director(s)/cast are relational now — see MovieDirector/MovieActor + Director/Actor models.
  },
  { timestamps: true },
);

withCleanJSON(movieSchema);

module.exports = mongoose.model('Movie', movieSchema);
