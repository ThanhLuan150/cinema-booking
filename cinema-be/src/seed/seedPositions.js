const Position = require('../models/Position');
const Permission = require('../models/Permission');
const PositionPermission = require('../models/PositionPermission');
const nextId = require('../utils/nextId');

const POSITIONS = [
  { code: 'TICKET_STAFF', name: 'Ticket Staff' },
  { code: 'CASHIER', name: 'Cashier' },
  { code: 'COMBO_STAFF', name: 'Combo Staff' },
  { code: 'TICKET_CHECKER', name: 'Ticket Checker' },
  { code: 'CUSTOMER_SERVICE', name: 'Customer Service' },
  { code: 'SECURITY', name: 'Security' },
  { code: 'CLEANING_STAFF', name: 'Cleaning Staff' },
  { code: 'MAINTENANCE_STAFF', name: 'Maintenance Staff' },
];

const POSITION_PERMISSIONS = {
  TICKET_STAFF: {
    'movie.read': 'ALL',
    'schedule.read': 'BRANCH',
    'room.read': 'BRANCH',
    'seat.read': 'BRANCH',
    'booking.read': 'BRANCH',
    'booking.create': 'BRANCH',
    'booking.cancel': 'BRANCH',
    'ticket.read': 'BRANCH',
    'payment.create': 'BRANCH',
  },

  CASHIER: {
    'booking.read': 'BRANCH',
    'booking.create': 'BRANCH',
    'ticket.read': 'BRANCH',
    'combo.read': 'BRANCH',
    'combo.sell': 'BRANCH',
    'payment.create': 'BRANCH',
  },
  COMBO_STAFF: {
    'combo.read': 'BRANCH',
    'combo.sell': 'BRANCH',
    'combo.order.view': 'BRANCH',
    'combo.order.update': 'BRANCH',
    'payment.create': 'BRANCH',
  },
  TICKET_CHECKER: {
    'ticket.read': 'BRANCH',
    'ticket.checkin': 'BRANCH',
  },
  CUSTOMER_SERVICE: {
    'movie.read': 'ALL',
    'schedule.read': 'BRANCH',
    'booking.read': 'BRANCH',
    'ticket.read': 'BRANCH',
  },

  SECURITY: {},
  CLEANING_STAFF: {},
  MAINTENANCE_STAFF: {},
};

async function seedPositions() {
  const positionByCode = {};
  for (const positionDef of POSITIONS) {
    let position = await Position.findOne({ code: positionDef.code });
    if (!position) {
      const id = await nextId('position');
      position = await Position.create({ id, ...positionDef, status: 1 });
      console.log(`Created position: ${positionDef.code}`);
    }
    positionByCode[positionDef.code] = position;
  }

  for (const [positionCode, permissionScopes] of Object.entries(POSITION_PERMISSIONS)) {
    const position = positionByCode[positionCode];
    const desired = new Map();
    for (const [code, scope] of Object.entries(permissionScopes)) {
      const permission = await Permission.findOne({ code });
      if (!permission) throw new Error(`seedPositions: unknown permission code "${code}" — run seedRbac() first`);
      desired.set(permission.id, scope);
    }

    for (const [permissionId, scope] of desired) {
      const existing = await PositionPermission.findOne({ position_id: position.id, permission_id: permissionId });
      if (!existing) {
        const id = await nextId('positionPermission');
        await PositionPermission.create({ id, position_id: position.id, permission_id: permissionId, scope });
      } else if (existing.scope !== scope) {
        existing.scope = scope;
        await existing.save();
      }
    }

    const currentLinks = await PositionPermission.find({ position_id: position.id });
    const staleLinks = currentLinks.filter((link) => !desired.has(link.permission_id));
    if (staleLinks.length > 0) {
      await PositionPermission.deleteMany({ _id: { $in: staleLinks.map((link) => link._id) } });
    }
  }

  console.log('Position seed complete.');
}

module.exports = seedPositions;
