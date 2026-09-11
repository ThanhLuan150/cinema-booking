const crypto = require('crypto');
const { verifyMomoSignature } = require('../utils/momo');

// Generic HMAC-SHA256-over-the-JSON-body verifier, the shape most webhook providers use
// (GitHub, Stripe, ...): a hex digest, optionally prefixed "sha256=", in a signature header.
// A provider whose framing differs plugs in its own verifier here instead (as MOMO does).
function verifyGenericHmac(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const given = String(signatureHeader).replace(/^sha256=/, '');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const givenBuf = Buffer.from(given, 'utf8');
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}

// Returns { required, verified }. `required` is false only when there is nothing to check
// the signature against (no secret configured for this provider) — the caller decides
// whether to accept unsigned traffic in that case, matching "signature verification only
// when the provider supports/needs it" and MoMo's own no-sandbox-creds dev fallback.
function verify({ provider, body, headers = {}, secret }) {
  if (String(provider).toUpperCase() === 'MOMO') {
    return { required: true, verified: verifyMomoSignature(body) };
  }
  if (!secret) return { required: false, verified: false };
  const signatureHeader = headers['x-webhook-signature'] || headers['x-signature'];
  return { required: true, verified: verifyGenericHmac(JSON.stringify(body || {}), signatureHeader, secret) };
}

module.exports = { verify, verifyGenericHmac };
