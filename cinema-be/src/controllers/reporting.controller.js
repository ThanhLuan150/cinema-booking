const reportingService = require('../services/reporting.service');

async function withScope(req, res, run) {
  let scope;
  try {
    scope = await reportingService.resolveReportScope(req, { branchIdParam: req.query.branchId });
  } catch (err) {
    if (err instanceof reportingService.ReportAccessError) {
      return res.status(403).json({ message: err.message });
    }
    throw err;
  }
  return run(scope.branchIds);
}

// GET /api/reports/financial?branchId=&from=&to=
async function financial(req, res) {
  return withScope(req, res, async (branchIds) => {
    const report = await reportingService.getFinancialReport({
      branchIds,
      from: req.query.from,
      to: req.query.to,
    });
    res.json(report);
  });
}

// GET /api/reports/operational?branchId=
async function operational(req, res) {
  return withScope(req, res, async (branchIds) => {
    // The account is passed through so the service can narrow the metric set to what this
    // caller's Position actually justifies — see OPERATIONAL_METRICS.
    res.json(await reportingService.getOperationalReport({ branchIds, account: req.account }));
  });
}

module.exports = { financial, operational };
