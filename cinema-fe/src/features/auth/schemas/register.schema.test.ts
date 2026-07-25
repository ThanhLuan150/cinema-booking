import { describe, expect, it } from 'vitest';
import { buildRegisterSchema } from './register.schema';

const t = ((key: string) => key) as any;
const registerSchema = buildRegisterSchema(t);

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'Secret1!',
      c_password: 'Secret1!',
      role: '1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a password without a special character', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'Secret123',
      c_password: 'Secret123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched password confirmation', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'Secret1!',
      c_password: 'Different1!',
    });
    expect(result.success).toBe(false);
  });
});
