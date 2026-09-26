function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  // A deliberate, client-facing domain error (e.g. InsufficientStockError) carries a string
  // `code` (the FE translates it via errors.json) and optional `shortages`; it is an expected
  // outcome, not a server fault, so it is neither logged nor masked.
  if (status < 500 && typeof err.code === 'string') {
    const body = { message: err.message, code: err.code };
    if (err.shortages) {
      body.shortages = err.shortages;
      // Flat copies of the first shortage feed the FE's i18n interpolation ({{item}}, {{available}}).
      const [first] = err.shortages;
      if (first) Object.assign(body, { item: first.item, requested: first.requested, available: first.available });
    }
    return res.status(status).json(body);
  }
  console.error(err);
  res.status(status).json({ message: err.message || 'Internal server error' });
}

module.exports = { notFound, errorHandler };
