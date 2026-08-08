const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const movieDirectorSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    movie_id: { type: Number, required: true, index: true },
    director_id: { type: Number, required: true, index: true },
  },
  { timestamps: true },
);

withCleanJSON(movieDirectorSchema);

module.exports = mongoose.model('MovieDirector', movieDirectorSchema);
