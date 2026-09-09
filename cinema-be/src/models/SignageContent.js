const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// A piece of content that can be scheduled onto a Branch's Screens. `branch_id` owns it — a
// Screen only ever plays content of its own branch. The optional reference columns are read
// according to `type`: MOVIE_POSTER / COMING_SOON -> movie_id; SHOWTIME -> schedule_id (dropped
// from playback if that Schedule is CANCELLED or belongs to another branch); PROMOTION ->
// promotion_id; ADVERTISEMENT / ANNOUNCEMENT -> free-form title + body + image_url.
const TYPES = ['MOVIE_POSTER', 'SHOWTIME', 'COMING_SOON', 'PROMOTION', 'ADVERTISEMENT', 'ANNOUNCEMENT'];
const STATUSES = ['ACTIVE', 'INACTIVE'];

const signageContentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    type: { type: String, enum: TYPES, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    image_url: { type: String, default: '' },
    movie_id: { type: Number, default: null, index: true },
    schedule_id: { type: Number, default: null, index: true },
    promotion_id: { type: Number, default: null, index: true },
    status: { type: String, enum: STATUSES, default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

withCleanJSON(signageContentSchema);

const SignageContent = mongoose.model('SignageContent', signageContentSchema);
SignageContent.TYPES = TYPES;
SignageContent.STATUSES = STATUSES;

module.exports = SignageContent;
