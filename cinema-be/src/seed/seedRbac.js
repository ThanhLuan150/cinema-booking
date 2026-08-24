const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const nextId = require('../utils/nextId');

// Role.code -> Account.role. The JWT payload and Account model still carry this numeric
// field (unchanged to avoid a data migration), but every route now authorizes via
// requirePermission(...) against the tables below — legacy_role_number is only how that
// middleware resolves "which Role does this JWT's numeric role correspond to".
const ROLES = [
  { code: 'SUPER_ADMIN', legacy_role_number: 0, name: 'Super Admin' },
  { code: 'CUSTOMER', legacy_role_number: 1, name: 'Customer' },
  { code: 'BRANCH_ADMIN', legacy_role_number: 2, name: 'Branch Admin' },
  { code: 'EMPLOYEE', legacy_role_number: 3, name: 'Employee' },
];

// One permission per module action. This is the single source of truth for every
// requirePermission(...) check across the route files — every route's guard maps to
// exactly one of these codes, and ROLE_PERMISSION_MAP below reproduces the same
// allow/deny behavior the routes used to hardcode via requireRole(...).
const PERMISSIONS = [
  ['branch.create', 'branch'], ['branch.read', 'branch'], ['branch.update', 'branch'],
  ['branch.delete', 'branch'], ['branch.activate', 'branch'], ['branch.disable', 'branch'],
  ['branch.assignAdmin', 'branch'],
  ['branchAdmin.create', 'branch'],
  ['company.create', 'company'], ['company.read', 'company'],
  ['company.update', 'company'], ['company.delete', 'company'],
  ['room.create', 'room'], ['room.read', 'room'], ['room.update', 'room'], ['room.delete', 'room'],
  ['seat.create', 'seat'], ['seat.read', 'seat'], ['seat.update', 'seat'], ['seat.delete', 'seat'],
  ['movie.create', 'movie'], ['movie.read', 'movie'], ['movie.update', 'movie'], ['movie.delete', 'movie'],
  ['category.create', 'category'], ['category.read', 'category'],
  ['schedule.create', 'schedule'], ['schedule.read', 'schedule'],
  ['schedule.update', 'schedule'], ['schedule.delete', 'schedule'], ['schedule.cancel', 'schedule'],
  ['ticket.create', 'ticket'], ['ticket.read', 'ticket'], ['ticket.checkin', 'ticket'], ['ticket.generate', 'ticket'],
  ['booking.create', 'booking'], ['booking.read', 'booking'],
  ['booking.refund', 'booking'], ['booking.admin', 'booking'],
  ['voucher.create', 'voucher'], ['voucher.read', 'voucher'],
  ['voucher.update', 'voucher'], ['voucher.delete', 'voucher'],
  ['combo.create', 'combo'], ['combo.read', 'combo'], ['combo.update', 'combo'], ['combo.delete', 'combo'],
  ['review.create', 'review'], ['review.read', 'review'], ['review.moderate', 'review'],
  ['user.read', 'user'], ['user.update', 'user'],
  ['user.block', 'user'], ['user.approve', 'user'], ['user.delete', 'user'],
  ['employee.create', 'employee'], ['employee.read', 'employee'],
  ['employee.update', 'employee'], ['employee.delete', 'employee'],
  ['actor.create', 'actor'], ['actor.read', 'actor'], ['actor.update', 'actor'], ['actor.delete', 'actor'],
  ['director.create', 'director'], ['director.read', 'director'],
  ['director.update', 'director'], ['director.delete', 'director'],
  ['dashboard.view', 'dashboard'], ['dashboard.viewSystem', 'dashboard'],
  ['position.read', 'position'],
  ['payment.create', 'payment'],
  ['payment.read', 'payment'],
  ['booking.cancel', 'booking'],
  ['combo.sell', 'combo'], ['combo.order.view', 'combo'], ['combo.order.update', 'combo'],
  ['shift.create', 'shift'], ['shift.read', 'shift'], ['shift.update', 'shift'], ['shift.delete', 'shift'],
  ['shiftAssignment.create', 'shiftAssignment'], ['shiftAssignment.read', 'shiftAssignment'],
  ['shiftAssignment.update', 'shiftAssignment'], ['shiftAssignment.delete', 'shiftAssignment'],
  ['pricingRule.create', 'pricingRule'], ['pricingRule.read', 'pricingRule'],
  ['pricingRule.update', 'pricingRule'], ['pricingRule.delete', 'pricingRule'],
];

const SUPER_ADMIN_PERMISSIONS = PERMISSIONS.map(([code]) => code);

const BRANCH_ADMIN_PERMISSIONS = {
  'branch.read': 'BRANCH',
  'branch.update': 'BRANCH',
  'room.create': 'BRANCH', 'room.read': 'BRANCH', 'room.update': 'BRANCH', 'room.delete': 'BRANCH',
  'seat.create': 'BRANCH', 'seat.read': 'BRANCH', 'seat.update': 'BRANCH', 'seat.delete': 'BRANCH',
  'movie.read': 'ALL',
  'category.read': 'ALL',
  'schedule.create': 'BRANCH', 'schedule.read': 'BRANCH',
  'schedule.update': 'BRANCH', 'schedule.delete': 'BRANCH', 'schedule.cancel': 'BRANCH',
  'ticket.read': 'BRANCH', 'ticket.checkin': 'BRANCH',
  'booking.create': 'BRANCH', 'booking.read': 'BRANCH', 'booking.cancel': 'BRANCH',
  'voucher.create': 'BRANCH', 'voucher.read': 'BRANCH', 'voucher.update': 'BRANCH', 'voucher.delete': 'BRANCH',
  'combo.create': 'BRANCH', 'combo.read': 'BRANCH', 'combo.update': 'BRANCH', 'combo.delete': 'BRANCH',
  'review.read': 'ALL',
  'employee.create': 'BRANCH', 'employee.read': 'BRANCH', 'employee.update': 'BRANCH', 'employee.delete': 'BRANCH',
  'actor.read': 'ALL', 'director.read': 'ALL',
  'dashboard.view': 'BRANCH',
  'position.read': 'ALL',
  'payment.create': 'BRANCH',
  'payment.read': 'BRANCH',
  'shift.create': 'BRANCH', 'shift.read': 'BRANCH', 'shift.update': 'BRANCH', 'shift.delete': 'BRANCH',
  'shiftAssignment.create': 'BRANCH', 'shiftAssignment.read': 'BRANCH',
  'shiftAssignment.update': 'BRANCH', 'shiftAssignment.delete': 'BRANCH',
  'pricingRule.create': 'BRANCH', 'pricingRule.read': 'BRANCH',
  'pricingRule.update': 'BRANCH', 'pricingRule.delete': 'BRANCH',
};

const EMPLOYEE_PERMISSIONS = {
  'movie.read': 'ALL',
  'category.read': 'ALL',
  'combo.read': 'ALL',
  'review.read': 'ALL',
  'room.read': 'ALL', 'seat.read': 'ALL',
  'actor.read': 'ALL', 'director.read': 'ALL',
  // Own work schedule only — see the Ticket 04 note against auto-restricting this per Position.
  'shiftAssignment.read': 'OWN',
};

const CUSTOMER_PERMISSIONS = {
  'movie.read': 'ALL',
  'category.read': 'ALL',
  'room.read': 'ALL', 'seat.read': 'ALL',
  'schedule.read': 'ALL',
  'ticket.read': 'OWN', 'booking.create': 'OWN', 'booking.read': 'OWN', 'booking.cancel': 'OWN',
  'combo.read': 'ALL', 'review.create': 'OWN', 'review.read': 'ALL',
  'actor.read': 'ALL', 'director.read': 'ALL',
  'payment.create': 'OWN',
  'payment.read': 'OWN',
};

function normalizePermissionScopes(permissions) {
  if (Array.isArray(permissions)) {
    return permissions.map((code) => ({ code, scope: 'ALL' }));
  }
  return Object.entries(permissions).map(([code, scope]) => ({ code, scope }));
}

const ROLE_PERMISSION_MAP = {
  SUPER_ADMIN: normalizePermissionScopes(SUPER_ADMIN_PERMISSIONS),
  BRANCH_ADMIN: normalizePermissionScopes(BRANCH_ADMIN_PERMISSIONS),
  EMPLOYEE: normalizePermissionScopes(EMPLOYEE_PERMISSIONS),
  CUSTOMER: normalizePermissionScopes(CUSTOMER_PERMISSIONS),
};

async function seedRbac() {
  const roleByCode = {};
  for (const roleDef of ROLES) {
    let role = await Role.findOne({ code: roleDef.code });
    if (!role) {
      const id = await nextId('role');
      role = await Role.create({ id, ...roleDef });
      console.log(`Created role: ${roleDef.code}`);
    }
    roleByCode[roleDef.code] = role;
  }

  const permissionByCode = {};
  for (const [code, module] of PERMISSIONS) {
    let permission = await Permission.findOne({ code });
    if (!permission) {
      const id = await nextId('permission');
      permission = await Permission.create({ id, code, module });
      console.log(`Created permission: ${code}`);
    }
    permissionByCode[code] = permission;
  }

  for (const [roleCode, permissionScopes] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = roleByCode[roleCode];
    const desired = new Map(permissionScopes.map(({ code, scope }) => [permissionByCode[code].id, scope]));

    for (const [permissionId, scope] of desired) {
      const existing = await RolePermission.findOne({ role_id: role.id, permission_id: permissionId });
      if (!existing) {
        const id = await nextId('rolePermission');
        await RolePermission.create({ id, role_id: role.id, permission_id: permissionId, scope });
      } else if (existing.scope !== scope) {
        existing.scope = scope;
        await existing.save();
      }
    }

    const currentLinks = await RolePermission.find({ role_id: role.id });
    const staleLinks = currentLinks.filter((link) => !desired.has(link.permission_id));
    if (staleLinks.length > 0) {
      await RolePermission.deleteMany({ _id: { $in: staleLinks.map((link) => link._id) } });
    }
  }

  console.log('RBAC seed complete.');
}

module.exports = seedRbac;
