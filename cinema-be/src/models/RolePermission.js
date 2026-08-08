const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const rolePermissionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    role_id: { type: Number, required: true, index: true },
    permission_id: { type: Number, required: true, index: true },
  },
  { timestamps: true },
);

rolePermissionSchema.index({ role_id: 1, permission_id: 1 }, { unique: true });

withCleanJSON(rolePermissionSchema);

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
