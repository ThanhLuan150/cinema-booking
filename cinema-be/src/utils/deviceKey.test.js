const { generateDeviceKey, hashDeviceKey } = require('./deviceKey');

describe('deviceKey', () => {
  it('generates a prefixed, unguessable key', () => {
    const key = generateDeviceKey();
    expect(key).toMatch(/^DEV-[0-9a-f]{48}$/);
    expect(generateDeviceKey()).not.toBe(key);
  });

  it('hashes deterministically to a 64-char hex digest', () => {
    const hash = hashDeviceKey('DEV-abc');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeviceKey('DEV-abc')).toBe(hash);
    expect(hashDeviceKey('DEV-abd')).not.toBe(hash);
  });
});
