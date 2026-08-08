const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const permissionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true }, // e.g. 'employee.create'
    module: { type: String, required: true }, // e.g. 'employee'
    description: { type: String, default: '' },
  },
  { timestamps: true },
);

withCleanJSON(permissionSchema);

module.exports = mongoose.model('Permission', permissionSchema);
