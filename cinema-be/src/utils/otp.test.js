const { generateOtp, otpExpiryDate } = require('./otp');

describe('generateOtp', () => {
  it('generates a 6-digit numeric string', () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('generates a value within the 100000-999999 range', () => {
    const otp = Number(generateOtp());
    expect(otp).toBeGreaterThanOrEqual(100000);
    expect(otp).toBeLessThanOrEqual(999999);
  });

  it('generates different values across many calls (not hardcoded)', () => {
    const values = new Set(Array.from({ length: 20 }, () => generateOtp()));
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('otpExpiryDate', () => {
  it('returns a date 10 minutes in the future', () => {
    const now = Date.now();
    const expiry = otpExpiryDate();
    const diff = expiry.getTime() - now;
    expect(diff).toBeGreaterThan(9 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);
  });
});
