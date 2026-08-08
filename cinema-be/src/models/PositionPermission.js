const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const positionPermissionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    position_id: { type: Number, required: true, index: true },
    permission_id: { type: Number, required: true, index: true },
    scope: { type: String, enum: ['ALL', 'BRANCH', 'OWN'], default: 'BRANCH' },
  },
  { timestamps: true },
);

positionPermissionSchema.index({ position_id: 1, permission_id: 1 }, { unique: true });

withCleanJSON(positionPermissionSchema);

module.exports = mongoose.model('PositionPermission', positionPermissionSchema);
