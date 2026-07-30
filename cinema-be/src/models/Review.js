const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const reviewSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    // Exactly one of movie_id / cinema_id is set per review, depending on what's being reviewed.
    movie_id: { type: Number, default: null, index: true },
    cinema_id: { type: Number, default: null, index: true },
    account_id: { type: Number, required: true, index: true },
    // Null for a top-level rated review; set to the parent review's id for a reply (no rating).
    parent_id: { type: Number, default: null, index: true },
    rating: { type: Number, default: null, min: 1, max: 5 },
    comment: { type: String, default: '' },
    hidden: { type: Boolean, default: false },
    reactions: [
      {
        _id: false,
        account_id: { type: Number, required: true },
        type: { type: String, required: true, enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'] },
      },
    ],
    reports: [
      {
        _id: false,
        account_id: { type: Number, required: true },
        reason: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

// "One review per user per movie/cinema" only applies to top-level reviews; replies are unlimited.
reviewSchema.index(
  { movie_id: 1, account_id: 1 },
  { unique: true, partialFilterExpression: { movie_id: { $type: 'number' }, parent_id: null } },
);
reviewSchema.index(
  { cinema_id: 1, account_id: 1 },
  { unique: true, partialFilterExpression: { cinema_id: { $type: 'number' }, parent_id: null } },
);

withCleanJSON(reviewSchema);

module.exports = mongoose.model('Review', reviewSchema);
