const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const movieCategorySchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    movie_id: { type: Number, required: true, index: true },
    cat_id: { type: Number, required: true, index: true },
  },
  { timestamps: true },
);

withCleanJSON(movieCategorySchema);

module.exports = mongoose.model('MovieCategory', movieCategorySchema);
