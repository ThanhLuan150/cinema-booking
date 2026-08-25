const { generateQrToken } = require('./qrToken');

describe('generateQrToken', () => {
  it('returns an opaque TCK- prefixed token', () => {
    const token = generateQrToken();
    expect(token).toMatch(/^TCK-[0-9a-f]{48}$/);
  });

  it('never contains any recognizable business identifiers itself', () => {
    const token = generateQrToken();
    expect(token).not.toMatch(/booking|invoice|payment|price|amount/i);
  });

  it('generates a different token on every call', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateQrToken()));
    expect(tokens.size).toBe(20);
  });
});
