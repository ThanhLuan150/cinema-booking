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
  director: 'Christopher Nolan',
  cast: [{ name: 'Leonardo DiCaprio', role: 'Cobb', avatar: '' }],
  categoryIds: [1],
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

  it('rejects a missing director', () => {
    const result = movieSchema.safeParse({ ...validMovie, director: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a cast member with no name', () => {
    const result = movieSchema.safeParse({ ...validMovie, cast: [{ name: '', role: 'Cobb', avatar: '' }] });
    expect(result.success).toBe(false);
  });

  it('rejects a cast member with an invalid avatar URL', () => {
    const result = movieSchema.safeParse({
      ...validMovie,
      cast: [{ name: 'Leonardo DiCaprio', role: 'Cobb', avatar: 'not-a-url' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an empty cast avatar', () => {
    const result = movieSchema.safeParse({
      ...validMovie,
      cast: [{ name: 'Leonardo DiCaprio', role: 'Cobb', avatar: '' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid cast avatar URL', () => {
    const result = movieSchema.safeParse({
      ...validMovie,
      cast: [{ name: 'Leonardo DiCaprio', role: 'Cobb', avatar: 'https://example.com/avatar.jpg' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects when no category is selected', () => {
    const result = movieSchema.safeParse({ ...validMovie, categoryIds: [] });
    expect(result.success).toBe(false);
  });
});
