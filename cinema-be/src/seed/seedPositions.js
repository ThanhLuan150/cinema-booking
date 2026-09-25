const Position = require('../models/Position');
const Permission = require('../models/Permission');
const PositionPermission = require('../models/PositionPermission');
const Employee = require('../models/Employee');
const nextId = require('../utils/nextId');

// F&B_STAFF is spelled FNB_STAFF: the code doubles as an identifier in URLs, JSON keys and i18n
// lookups, where a literal "&" is a liability.
const POSITIONS = [
  { code: 'TICKET_STAFF', name: 'Ticket Staff' },
  { code: 'CASHIER', name: 'Cashier' },
  { code: 'CONCESSION_STAFF', name: 'Concession Staff' },
  { code: 'CHECK_IN_STAFF', name: 'Check-in Staff' },
  { code: 'USHER', name: 'Usher' },
  { code: 'CUSTOMER_SERVICE', name: 'Customer Service' },
  { code: 'SECURITY', name: 'Security' },
  { code: 'FNB_STAFF', name: 'F&B Staff' },
  { code: 'CLEANING_STAFF', name: 'Cleaning Staff' },
  { code: 'MAINTENANCE_STAFF', name: 'Maintenance Staff' },
];

// Positions renamed in Ticket 42. The row (and so its numeric id) is kept, which is what
// Employee.position_id and PositionPermission.position_id point at — renaming in place means no
// employee loses their assignment and no grant has to be re-created.
const LEGACY_CODE_RENAMES = {
  COMBO_STAFF: 'CONCESSION_STAFF',
  TICKET_CHECKER: 'CHECK_IN_STAFF',
};

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
    'ticket.create': 'BRANCH',
    'combo.view': 'BRANCH',
    'combo.sell': 'BRANCH',
    'payment.create': 'BRANCH',
    'cashierShift.open': 'BRANCH',
    'cashierShift.close': 'OWN',
    'cashierShift.read': 'OWN',
  },

  CASHIER: {
    'schedule.read': 'BRANCH',
    'booking.read': 'BRANCH',
    'booking.create': 'BRANCH',
    'ticket.read': 'BRANCH',
    'ticket.create': 'BRANCH',
    'combo.view': 'BRANCH',
    'combo.sell': 'BRANCH',
    'payment.create': 'BRANCH',
    'cashierShift.open': 'BRANCH',
    'cashierShift.close': 'OWN',
    'cashierShift.read': 'OWN',
  },
  CONCESSION_STAFF: {
    'combo.view': 'BRANCH',
    'combo.sell': 'BRANCH',
    'combo.order.view': 'BRANCH',
    'combo.order.update': 'BRANCH',
    'inventory.view': 'BRANCH',
    'payment.create': 'BRANCH',
  },
  CHECK_IN_STAFF: {
    'ticket.read': 'BRANCH',
    'ticket.checkin': 'BRANCH',
  },
  // Guides guests into the auditorium: verifies a ticket at the door and needs the room/seat
  // layout to seat people.
  USHER: {
    'ticket.read': 'BRANCH',
    'ticket.checkin': 'BRANCH',
    'room.read': 'BRANCH',
    'seat.read': 'BRANCH',
  },
  // Prepares and hands over F&B orders the counter took — works the order queue but does not sell.
  FNB_STAFF: {
    'combo.view': 'BRANCH',
    'combo.order.view': 'BRANCH',
    'combo.order.update': 'BRANCH',
    'inventory.view': 'BRANCH',
  },
  CUSTOMER_SERVICE: {
    'movie.read': 'ALL',
    'schedule.read': 'BRANCH',
    'booking.read': 'BRANCH',
    'booking.cancel': 'BRANCH',
    'booking.reschedule': 'BRANCH',
    'booking.changeShowtime': 'BRANCH',
    'ticket.read': 'BRANCH',
    'payment.read': 'BRANCH',
    'refund.request': 'BRANCH',
    'refund.read': 'BRANCH',
    'user.read': 'ALL',
    'supportTicket.create': 'BRANCH',
    'supportTicket.read': 'BRANCH',
    'supportTicket.update': 'BRANCH',
    // Look up a customer's activity profile while handling a request. The service returns a
    // reduced field set for EMPLOYEE callers (no marketing analytics) and scopes every
    // metric to this branch.
    'crm.viewCustomer': 'BRANCH',
  },

  SECURITY: {
    'room.read': 'BRANCH',
    'incident.create': 'BRANCH',
    'incident.read': 'BRANCH',
  },
  CLEANING_STAFF: {},
  // Every Employee already holds maintenance.create/read at the branch (seedRbac.js); this adds
  // the ability to actually work a ticket — start it (ASSIGNED -> IN_PROGRESS) and resolve it
  // (IN_PROGRESS -> RESOLVED). Assigning a ticket and closing it stay Branch Admin-only.
  MAINTENANCE_STAFF: {
    'maintenance.update': 'BRANCH',
  },
};

// Renames each legacy Position to its new code, in place. Idempotent, and safe against a database
// that already holds both codes (e.g. seedPositions ran before this migration): employees are
// moved onto the new Position and the legacy row and its grants are dropped.
async function renameLegacyPositions() {
  const summary = [];
  for (const [oldCode, newCode] of Object.entries(LEGACY_CODE_RENAMES)) {
    const legacy = await Position.findOne({ code: oldCode });
    if (!legacy) continue;
    const displayName = POSITIONS.find((p) => p.code === newCode).name;
    const current = await Position.findOne({ code: newCode });
    if (!current) {
      await Position.updateOne({ id: legacy.id }, { $set: { code: newCode, name: displayName } });
      summary.push({ from: oldCode, to: newCode, merged: false });
    } else {
      await Employee.updateMany({ position_id: legacy.id }, { $set: { position_id: current.id } });
      await PositionPermission.deleteMany({ position_id: legacy.id });
      await Position.deleteOne({ id: legacy.id });
      summary.push({ from: oldCode, to: newCode, merged: true });
    }
  }
  return summary;
}

async function seedPositions() {
  await renameLegacyPositions();
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
module.exports.renameLegacyPositions = renameLegacyPositions;
module.exports.LEGACY_CODE_RENAMES = LEGACY_CODE_RENAMES;
