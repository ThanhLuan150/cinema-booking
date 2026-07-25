function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function otpExpiryDate() {
  return new Date(Date.now() + OTP_TTL_MS);
}

module.exports = { generateOtp, otpExpiryDate };
