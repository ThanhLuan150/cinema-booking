const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const reviewSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    // Exactly one of movie_id / cinema_id is set per review, depending on what's being reviewed.
    movie_id: { type: Number, default: null, index: true },
    cinema_id: { type: Number, default: null, index: true },
    account_id: { type: Number, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

reviewSchema.index(
  { movie_id: 1, account_id: 1 },
  { unique: true, partialFilterExpression: { movie_id: { $type: 'number' } } },
);
reviewSchema.index(
  { cinema_id: 1, account_id: 1 },
  { unique: true, partialFilterExpression: { cinema_id: { $type: 'number' } } },
);

withCleanJSON(reviewSchema);

module.exports = mongoose.model('Review', reviewSchema);
