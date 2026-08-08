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
  ['cinema.create', 'cinema'], ['cinema.read', 'cinema'], ['cinema.update', 'cinema'],
  ['cinema.delete', 'cinema'], ['cinema.approve', 'cinema'], ['cinema.block', 'cinema'],
  ['branchAdmin.create', 'cinema'],
  ['room.create', 'room'], ['room.read', 'room'], ['room.update', 'room'], ['room.delete', 'room'],
  ['seat.create', 'seat'], ['seat.read', 'seat'], ['seat.update', 'seat'], ['seat.delete', 'seat'],
  ['movie.create', 'movie'], ['movie.read', 'movie'], ['movie.update', 'movie'], ['movie.delete', 'movie'],
  ['category.create', 'category'], ['category.read', 'category'],
  ['schedule.create', 'schedule'], ['schedule.read', 'schedule'],
  ['schedule.update', 'schedule'], ['schedule.delete', 'schedule'],
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
];

const SUPER_ADMIN_PERMISSIONS = PERMISSIONS.map(([code]) => code);

const BRANCH_ADMIN_PERMISSIONS = [
  'cinema.create', 'cinema.read', 'cinema.update',
  'room.create', 'room.read', 'room.update', 'room.delete',
  'seat.create', 'seat.read', 'seat.update', 'seat.delete',
  'movie.create', 'movie.read', 'movie.update', 'movie.delete',
  'category.create', 'category.read',
  'schedule.read',
  'ticket.read', 'ticket.checkin',
  'booking.create', 'booking.read',
  'voucher.create', 'voucher.read', 'voucher.update', 'voucher.delete',
  'combo.create', 'combo.read', 'combo.update', 'combo.delete',
  'review.read',
  'employee.create', 'employee.read', 'employee.update', 'employee.delete',
  'actor.read', 'director.read',
  'dashboard.view',
];

// NOTE: these two roles deliberately do NOT include 'cinema.read'/'movie.read'/'voucher.read'
// even though they can view cinemas/movies/vouchers in the app — those browsing surfaces are
// public GET routes with no permission gate at all. The *.read codes here are reserved for the
// admin/owner "management listing" endpoints (e.g. GET /cinema/mine, GET /voucher), which
// customers and employees must not pass.
const EMPLOYEE_PERMISSIONS = [
  'seat.read', 'category.read', 'schedule.read',
  'ticket.read', 'ticket.checkin',
  'booking.create', 'booking.read',
  'combo.read', 'review.read',
  'actor.read', 'director.read',
];

const CUSTOMER_PERMISSIONS = [
  'category.read',
  'ticket.read', 'booking.create', 'booking.read',
  'combo.read', 'review.create', 'review.read',
  'actor.read', 'director.read',
];

const ROLE_PERMISSION_MAP = {
  SUPER_ADMIN: SUPER_ADMIN_PERMISSIONS,
  BRANCH_ADMIN: BRANCH_ADMIN_PERMISSIONS,
  EMPLOYEE: EMPLOYEE_PERMISSIONS,
  CUSTOMER: CUSTOMER_PERMISSIONS,
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

  // Sync each role's RolePermission links to exactly match ROLE_PERMISSION_MAP: add
  // whatever's missing, prune whatever's no longer granted. Keeps this file the single
  // source of truth even as the map changes across releases.
  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = roleByCode[roleCode];
    const desiredPermissionIds = new Set(permissionCodes.map((code) => permissionByCode[code].id));

    for (const permissionId of desiredPermissionIds) {
      const exists = await RolePermission.findOne({ role_id: role.id, permission_id: permissionId });
      if (!exists) {
        const id = await nextId('rolePermission');
        await RolePermission.create({ id, role_id: role.id, permission_id: permissionId });
      }
    }

    const currentLinks = await RolePermission.find({ role_id: role.id });
    const staleLinks = currentLinks.filter((link) => !desiredPermissionIds.has(link.permission_id));
    if (staleLinks.length > 0) {
      await RolePermission.deleteMany({ _id: { $in: staleLinks.map((link) => link._id) } });
    }
  }

  console.log('RBAC seed complete.');
}

module.exports = seedRbac;
