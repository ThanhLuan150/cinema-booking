import { describe, expect, it } from 'vitest';
import { buildUserInfoSchema } from './userInfo.schema';

const t = ((key: string) => key) as any;
const userInfoSchema = buildUserInfoSchema(t);

describe('userInfoSchema', () => {
  it('accepts a valid name and 10-digit phone', () => {
    const result = userInfoSchema.safeParse({ name: 'Nguyen Van A', phone: '0912345678' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty name (optional)', () => {
    const result = userInfoSchema.safeParse({ name: '', phone: '0912345678' });
    expect(result.success).toBe(true);
  });

  it('rejects a name containing digits or symbols', () => {
    const result = userInfoSchema.safeParse({ name: 'John123', phone: '0912345678' });
    expect(result.success).toBe(false);
  });

  it('rejects a phone number that is not exactly 10 digits', () => {
    const result = userInfoSchema.safeParse({ name: 'John', phone: '12345' });
    expect(result.success).toBe(false);
  });

  it('rejects a phone number containing non-digit characters', () => {
    const result = userInfoSchema.safeParse({ name: 'John', phone: '09-1234567' });
    expect(result.success).toBe(false);
  });
});
