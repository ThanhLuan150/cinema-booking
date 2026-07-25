const crypto = require('crypto');
const axios = require('axios');

function encodeExtraData(payload) {
  return Buffer.from(JSON.stringify(payload || {})).toString('base64');
}

function decodeExtraData(extraData) {
  if (!extraData) return {};
  try {
    return JSON.parse(Buffer.from(extraData, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

// Creates a MoMo "captureWallet" payment request and returns the hosted payUrl the
// browser should redirect to. `orderPayload` is round-tripped through MoMo's
// `extraData` field so the IPN/redirect callback can recover what was being purchased
// without needing a separate "pending order" table.
async function createMomoPaymentUrl(amount, orderPayload) {
  const partnerCode = process.env.MOMO_PARTNER_CODE;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const endpoint = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';
  const redirectUrl = process.env.MOMO_REDIRECT_URL || 'http://localhost:3000/PaymentResult';
  const ipnUrl = process.env.MOMO_IPN_URL || 'http://localhost:8000/api/MomoPayment/ipn';

  const safeAmount = Math.max(1000, Math.round(Number(amount) || 0));
  const extraData = encodeExtraData(orderPayload);

  if (!partnerCode || !accessKey || !secretKey) {
    // No sandbox credentials configured: fall back to a mock redirect so the flow can
    // still be exercised locally, carrying the same extraData the real flow would.
    const mockUrl = `${redirectUrl}?resultCode=0&message=Mock+payment+success&amount=${safeAmount}&extraData=${encodeURIComponent(extraData)}&orderId=MOCK-${Date.now()}`;
    return mockUrl;
  }

  const requestId = `${partnerCode}-${Date.now()}`;
  const orderId = requestId;
  const orderInfo = 'Pay for cinema ticket';
  const requestType = 'captureWallet';

  const rawSignature =
    `accessKey=${accessKey}&amount=${safeAmount}&extraData=${extraData}&ipnUrl=${ipnUrl}` +
    `&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}` +
    `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

  const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

  const payload = {
    partnerCode,
    accessKey,
    requestId,
    amount: String(safeAmount),
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    extraData,
    requestType,
    signature,
    lang: 'vi',
  };

  const { data } = await axios.post(endpoint, payload, { timeout: 10000 });
  return data.payUrl || `${redirectUrl}?resultCode=${data.resultCode}&message=${encodeURIComponent(data.message || '')}`;
}

// Recomputes MoMo's callback signature (used by both the IPN webhook and the
// browser-redirect fallback) and compares it to the one MoMo sent, per MoMo's
// documented field order for payment-result callbacks.
function verifyMomoSignature(params) {
  const secretKey = process.env.MOMO_SECRET_KEY;
  if (!secretKey) return true; // mock mode: nothing to verify against

  const {
    accessKey = process.env.MOMO_ACCESS_KEY,
    amount,
    extraData = '',
    message,
    orderId,
    orderInfo,
    orderType,
    partnerCode,
    payType,
    requestId,
    responseTime,
    resultCode,
    transId,
    signature,
  } = params;

  const rawSignature =
    `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}` +
    `&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}` +
    `&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}` +
    `&resultCode=${resultCode}&transId=${transId}`;

  const expected = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
  return expected === signature;
}

module.exports = { createMomoPaymentUrl, verifyMomoSignature, decodeExtraData, encodeExtraData };
