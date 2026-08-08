import { describe, expect, it } from 'vitest';
import { buildMovieSchema } from './movie.schema';

const t = ((key: string) => key) as any;
const movieSchema = buildMovieSchema(t);

const validMovie = {
  name: 'Inception',
  avatar: 'poster.jpg',
  premiere_date: '2026-08-01',
  description: 'A mind-bending thriller.',
  country: 'USA',
  trailer: 'trailer.mp4',
  producer: 'Emma Thomas',
  producerAvatar: '',
  categoryIds: [1],
  directorIds: [1],
  actors: [{ actor_id: 1, character_name: 'Cobb', is_lead: true }],
};

describe('movieSchema', () => {
  it('accepts a fully filled movie', () => {
    const result = movieSchema.safeParse(validMovie);
    expect(result.success).toBe(true);
  });

  it('rejects a missing name', () => {
    const result = movieSchema.safeParse({ ...validMovie, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing avatar', () => {
    const result = movieSchema.safeParse({ ...validMovie, avatar: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid premiere date format', () => {
    const result = movieSchema.safeParse({ ...validMovie, premiere_date: '08/01/2026' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing description', () => {
    const result = movieSchema.safeParse({ ...validMovie, description: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing country', () => {
    const result = movieSchema.safeParse({ ...validMovie, country: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing trailer', () => {
    const result = movieSchema.safeParse({ ...validMovie, trailer: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing producer', () => {
    const result = movieSchema.safeParse({ ...validMovie, producer: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid producerAvatar URL', () => {
    const result = movieSchema.safeParse({ ...validMovie, producerAvatar: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid producerAvatar URL', () => {
    const result = movieSchema.safeParse({ ...validMovie, producerAvatar: 'https://example.com/a.jpg' });
    expect(result.success).toBe(true);
  });

  it('rejects when no category is selected', () => {
    const result = movieSchema.safeParse({ ...validMovie, categoryIds: [] });
    expect(result.success).toBe(false);
  });

  it('rejects when no director is selected', () => {
    const result = movieSchema.safeParse({ ...validMovie, directorIds: [] });
    expect(result.success).toBe(false);
  });

  it('accepts an empty actors list', () => {
    const result = movieSchema.safeParse({ ...validMovie, actors: [] });
    expect(result.success).toBe(true);
  });
});
