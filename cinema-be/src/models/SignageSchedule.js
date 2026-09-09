const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// A playlist entry: it books one SignageContent onto one Screen for a time window. `priority`
// orders overlapping entries on the same Screen (higher shows first). Both the content and the
// screen must belong to the same Branch — enforced on write and re-checked at playback time.
const STATUSES = ['ACTIVE', 'INACTIVE'];

const signageScheduleSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    content_id: { type: Number, required: true, index: true },
    screen_id: { type: Number, required: true, index: true },
    start_at: { type: Date, required: true },
    end_at: { type: Date, required: true },
    priority: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

withCleanJSON(signageScheduleSchema);

const SignageSchedule = mongoose.model('SignageSchedule', signageScheduleSchema);
SignageSchedule.STATUSES = STATUSES;

module.exports = SignageSchedule;
