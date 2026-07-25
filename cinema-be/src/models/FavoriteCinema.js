const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const favoriteCinemaSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    cinema_id: { type: Number, required: true, index: true },
    account_id: { type: Number, required: true, index: true },
  },
  { timestamps: true },
);

favoriteCinemaSchema.index({ cinema_id: 1, account_id: 1 }, { unique: true });

withCleanJSON(favoriteCinemaSchema);

module.exports = mongoose.model('FavoriteCinema', favoriteCinemaSchema);
