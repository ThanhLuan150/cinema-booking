const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const directorSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    full_name: { type: String, required: true },
    avatar_url: { type: String, default: '' },
    bio: { type: String, default: '' },
    dob: { type: Date, default: null },
    nationality: { type: String, default: '' },
  },
  { timestamps: true },
);

withCleanJSON(directorSchema);

module.exports = mongoose.model('Director', directorSchema);
