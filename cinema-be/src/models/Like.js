const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const likeSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    movie_id: { type: Number, required: true, index: true },
    account_id: { type: Number, required: true, index: true },
  },
  { timestamps: true },
);

likeSchema.index({ movie_id: 1, account_id: 1 }, { unique: true });

withCleanJSON(likeSchema);

module.exports = mongoose.model('Like', likeSchema);
