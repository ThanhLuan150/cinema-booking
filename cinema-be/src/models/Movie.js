const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const AGE_RATINGS = ['P', 'K', 'T13', 'T16', 'T18', 'C'];

const movieSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    owner_id: { type: Number, default: null, index: true }, // account that added this movie; null = seeded/legacy
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '' }, // poster
    duration: { type: Number, default: 0 }, // minutes
    premiere_date: { type: String, required: true },
    description: { type: String, default: '' }, // synopsis
    country: { type: String, default: '' },
    trailer: { type: String, default: '' },
    producer: { type: String, default: '' },
    producerAvatar: { type: String, default: '' },
    banner: { type: String, default: '' }, // wide hero artwork for the detail page
    gallery: { type: [String], default: [] }, // still image URLs
    age_rating: { type: String, enum: AGE_RATINGS, default: 'P', index: true },
    language: { type: String, default: '' }, // spoken/audio language, e.g. "English"
    subtitle: { type: String, default: '' }, // subtitle language(s), e.g. "Tiếng Việt"
    featured: { type: Boolean, default: false, index: true }, // surfaced on curated/home rails
  },
  { timestamps: true },
);

withCleanJSON(movieSchema);

const Movie = mongoose.model('Movie', movieSchema);
Movie.AGE_RATINGS = AGE_RATINGS;

module.exports = Movie;
