import { describe, expect, it } from 'vitest';
import { buildCinemaInfoSchema } from './cinemaInfo.schema';

const t = ((key: string) => key) as any;
const cinemaInfoSchema = buildCinemaInfoSchema(t);

describe('cinemaInfoSchema', () => {
  it('accepts valid cinema info', () => {
    const result = cinemaInfoSchema.safeParse({
      name: 'Galaxy Cinema',
      phone: '0123456789',
      address: '123 Main St',
      city: 'Hanoi',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = cinemaInfoSchema.safeParse({
      name: '',
      phone: '0123456789',
      address: '123 Main St',
      city: 'Hanoi',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid phone number', () => {
    const result = cinemaInfoSchema.safeParse({
      name: 'Galaxy Cinema',
      phone: '123',
      address: '123 Main St',
      city: 'Hanoi',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty address', () => {
    const result = cinemaInfoSchema.safeParse({
      name: 'Galaxy Cinema',
      phone: '0123456789',
      address: '',
      city: 'Hanoi',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty city', () => {
    const result = cinemaInfoSchema.safeParse({
      name: 'Galaxy Cinema',
      phone: '0123456789',
      address: '123 Main St',
      city: '',
    });
    expect(result.success).toBe(false);
  });
});
