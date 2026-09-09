const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const STATUS = ['VISIBLE', 'HIDDEN', 'REJECTED'];

const reviewSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    // Exactly one of movie_id / cinema_id is set per review, depending on what's being reviewed.
    movie_id: { type: Number, default: null, index: true },
    cinema_id: { type: Number, default: null, index: true },
    account_id: { type: Number, required: true, index: true },
    booking_id: { type: Number, default: null },
    // Null for a top-level rated review; set to the parent review's id for a reply (no rating).
    parent_id: { type: Number, default: null, index: true },
    rating: { type: Number, default: null, min: 1, max: 5 },
    comment: { type: String, default: '' },
    status: { type: String, enum: STATUS, default: 'VISIBLE', index: true },
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

// "One review per user per cinema" only applies to top-level cinema reviews; replies are unlimited.
reviewSchema.index(
  { cinema_id: 1, account_id: 1 },
  { unique: true, partialFilterExpression: { cinema_id: { $type: 'number' }, parent_id: null } },
);
// A verified-purchase movie review is tied 1:1 to the booking that earned it (Ticket 33: "một
// Booking chỉ được Review một lần") — not to movie_id+account_id, since the same customer may
// legitimately watch (and review) the same movie again from a separate booking.
reviewSchema.index(
  { booking_id: 1 },
  { unique: true, partialFilterExpression: { booking_id: { $type: 'number' }, parent_id: null } },
);

withCleanJSON(reviewSchema);

const Review = mongoose.model('Review', reviewSchema);
Review.STATUS = { VISIBLE: 'VISIBLE', HIDDEN: 'HIDDEN', REJECTED: 'REJECTED' };

module.exports = Review;
