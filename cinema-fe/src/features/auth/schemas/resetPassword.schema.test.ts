import { describe, expect, it } from 'vitest';
import { buildResetPasswordSchema } from './resetPassword.schema';

const t = ((key: string) => key) as any;
const resetPasswordSchema = buildResetPasswordSchema(t);

describe('resetPasswordSchema', () => {
  it('accepts a valid otp and matching passwords', () => {
    const result = resetPasswordSchema.safeParse({
      otp: '123456',
      password: 'Newpass1!',
      c_password: 'Newpass1!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty otp', () => {
    const result = resetPasswordSchema.safeParse({
      otp: '',
      password: 'Newpass1!',
      c_password: 'Newpass1!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = resetPasswordSchema.safeParse({
      otp: '123456',
      password: 'Nw1!',
      c_password: 'Nw1!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password without a special character', () => {
    const result = resetPasswordSchema.safeParse({
      otp: '123456',
      password: 'Newpass123',
      c_password: 'Newpass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({
      otp: '123456',
      password: 'Newpass1!',
      c_password: 'Different1!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['c_password']);
    }
  });
});
