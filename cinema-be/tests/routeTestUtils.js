const express = require('express');
const jwt = require('jsonwebtoken');

function buildTestApp(mountPath, router) {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return app;
}

function tokenFor({ accountId = 1, email = 'user@example.com', role = 1 } = {}) {
  return jwt.sign({ accountId, email, role }, process.env.JWT_SECRET);
}

function authHeader(overrides) {
  return `Bearer ${tokenFor(overrides)}`;
}

module.exports = { buildTestApp, tokenFor, authHeader };
