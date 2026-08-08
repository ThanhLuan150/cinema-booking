const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const roleSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: {
      type: String,
      required: true,
      unique: true,
      enum: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'EMPLOYEE', 'CUSTOMER'],
    },
    legacy_role_number: { type: Number, required: true, unique: true }, // maps to Account.role (0/2/3/1)
    name: { type: String, required: true },
  },
  { timestamps: true },
);

withCleanJSON(roleSchema);

module.exports = mongoose.model('Role', roleSchema);
