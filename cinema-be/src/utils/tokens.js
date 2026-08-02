const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function signAccessToken(account) {
  return jwt.sign(
    { accountId: account.id, email: account.email, role: account.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' },
  );
}

function signRefreshToken(account) {
  return jwt.sign({ accountId: account.id, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken };
