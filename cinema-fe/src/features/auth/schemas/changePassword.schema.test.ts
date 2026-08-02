import { describe, expect, it } from 'vitest';
import { buildChangePasswordSchema } from './changePassword.schema';

const t = ((key: string) => key) as any;
const changePasswordSchema = buildChangePasswordSchema(t);

describe('changePasswordSchema', () => {
  it('accepts matching, valid passwords', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpass',
      newPassword: 'Newpass1!',
      c_password: 'Newpass1!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'Newpass1!',
      c_password: 'Newpass1!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a new password shorter than 8 characters', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpass',
      newPassword: 'Nw1!',
      c_password: 'Nw1!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a new password without a special character', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpass',
      newPassword: 'Newpass123',
      c_password: 'Newpass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpass',
      newPassword: 'Newpass1!',
      c_password: 'Different1!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['c_password']);
    }
  });
});
