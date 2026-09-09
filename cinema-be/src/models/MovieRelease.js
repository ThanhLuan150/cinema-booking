const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const movieReleaseSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    movie_id: { type: Number, required: true, index: true },
    distributor_id: { type: Number, required: true, index: true },
    release_date: { type: String, required: true }, // YYYY-MM-DD
    end_date: { type: String, default: null }, // YYYY-MM-DD or null (open-ended run)
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

// One release row per (movie, distributor) pair — a movie can still have several rows if it
// is handled by more than one distributor (e.g. a re-release), and the showtime check passes
// when the start falls inside ANY active window.
movieReleaseSchema.index({ movie_id: 1, distributor_id: 1 }, { unique: true });

withCleanJSON(movieReleaseSchema);

module.exports = mongoose.model('MovieRelease', movieReleaseSchema);
