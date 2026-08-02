import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toFormikValidate } from './formikZod';

describe('toFormikValidate', () => {
  const schema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Too short'),
  });

  it('returns an empty object when validation succeeds', () => {
    const validate = toFormikValidate(schema);
    expect(validate({ email: 'user@example.com', password: 'secret1' })).toEqual({});
  });

  it('maps each issue to its field path with the first message', () => {
    const validate = toFormikValidate(schema);
    const errors = validate({ email: 'not-an-email', password: '123' });
    expect(errors).toEqual({ email: 'Invalid email', password: 'Too short' });
  });

  it('keeps only the first error message per field', () => {
    const nested = z.object({
      name: z.string().min(1, 'Required').max(3, 'Too long'),
    });
    const validate = toFormikValidate(nested);
    const errors = validate({ name: '' });
    expect(errors).toEqual({ name: 'Required' });
  });
});
