const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const castMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isLead: { type: Boolean, default: false },
  },
  { _id: false },
);

const movieSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    owner_id: { type: Number, default: null, index: true }, // account that added this movie; null = seeded/legacy
    name: { type: String, required: true },
    avatar: { type: String, default: '' },
    premiere_date: { type: String, required: true },
    description: { type: String, default: '' },
    country: { type: String, default: '' },
    trailer: { type: String, default: '' },
    producer: { type: String, default: '' },
    producerAvatar: { type: String, default: '' },
    director: { type: String, default: '' },
    directorAvatar: { type: String, default: '' },
    cast: { type: [castMemberSchema], default: [] },
  },
  { timestamps: true },
);

withCleanJSON(movieSchema);

module.exports = mongoose.model('Movie', movieSchema);
