const crmService = require('../services/customerCrm.service');

// GET /api/crm/me — the caller's own aggregated CRM / activity profile. Always unscoped
// (their whole history) and never redacted; it's their own data.
async function myProfile(req, res) {
  const profile = await crmService.buildCustomerProfile({
    accountId: req.account.accountId,
    branchIds: null,
    redact: false,
  });
  if (!profile) return res.status(404).json({ message: 'Account not found' });
  res.json(profile);
}

// GET /api/crm/customers/:accountId — a staff/admin view of one customer's profile.
// SUPER_ADMIN (ALL) sees system-wide figures for any customer; a Branch Admin / Customer
// Service rep (BRANCH) only sees figures drawn from their own branches, and only for a
// customer who has actually transacted there. EMPLOYEE-role callers get a reduced field
// set (see crmService.STAFF_REDACTED_FIELDS).
//
// This route is read-only: the derived figures (total_spending, total_bookings,
// loyalty_points, …) are recomputed from the backend on every call and the request body is
// never consulted, so a client can neither submit nor override them.
async function customerProfile(req, res) {
  let accountId;
  let branchIds;
  try {
    accountId = crmService.parseAccountId(req.params.accountId);
    ({ branchIds } = await crmService.resolveCrmScope(req));
  } catch (err) {
    if (err instanceof crmService.CrmAccessError) {
      return res.status(403).json({ message: err.message });
    }
    throw err;
  }

  const redact = req.roleCode === 'EMPLOYEE';
  const profile = await crmService.buildCustomerProfile({ accountId, branchIds, redact });
  if (!profile) return res.status(404).json({ message: 'Customer not found' });

  // A branch-scoped caller must not be able to enumerate customer accounts they have no
  // relationship with: if none of this customer's paid bookings fall in the caller's
  // branches, treat them as not found rather than returning an all-zero profile.
  if (branchIds != null && profile.total_bookings === 0) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  res.json(profile);
}

module.exports = { myProfile, customerProfile };
