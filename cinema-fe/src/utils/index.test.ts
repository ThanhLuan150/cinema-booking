import { describe, expect, it } from 'vitest';
import { getImageUrl, getMoviePosterUrl, getTrailerKind, getYoutubeEmbedUrl } from './index';

describe('getImageUrl', () => {
  it('returns an empty string for a nullish path', () => {
    expect(getImageUrl(undefined)).toBe('');
    expect(getImageUrl(null)).toBe('');
    expect(getImageUrl('')).toBe('');
  });

  it('returns absolute http(s) urls unchanged', () => {
    expect(getImageUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(getImageUrl('http://example.com/a.jpg')).toBe('http://example.com/a.jpg');
  });

  it('prefixes relative paths with /picture/', () => {
    expect(getImageUrl('movies/poster.jpg')).toBe('/picture/movies/poster.jpg');
  });
});

describe('getMoviePosterUrl', () => {
  it('delegates to getImageUrl', () => {
    expect(getMoviePosterUrl('poster.jpg')).toBe('/picture/poster.jpg');
    expect(getMoviePosterUrl(null)).toBe('');
  });
});

describe('getTrailerKind', () => {
  it('returns null for a nullish url', () => {
    expect(getTrailerKind(undefined)).toBeNull();
    expect(getTrailerKind(null)).toBeNull();
  });

  it('detects youtube urls', () => {
    expect(getTrailerKind('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
    expect(getTrailerKind('https://youtu.be/abc123')).toBe('youtube');
  });

  it('detects cloudinary/video urls', () => {
    expect(getTrailerKind('https://res.cloudinary.com/demo/video/upload/v1/trailer')).toBe('video');
    expect(getTrailerKind('https://example.com/trailer.mp4')).toBe('video');
  });

  it('falls back to image for anything else', () => {
    expect(getTrailerKind('https://example.com/poster.jpg')).toBe('image');
  });
});

describe('getYoutubeEmbedUrl', () => {
  it('extracts the video id from a watch url', () => {
    expect(getYoutubeEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe(
      'https://www.youtube.com/embed/abc123',
    );
  });

  it('extracts the video id from a short youtu.be url', () => {
    expect(getYoutubeEmbedUrl('https://youtu.be/xyz789')).toBe('https://www.youtube.com/embed/xyz789');
  });

  it('extracts the video id when extra query params follow', () => {
    expect(getYoutubeEmbedUrl('https://www.youtube.com/watch?v=abc123&t=30s')).toBe(
      'https://www.youtube.com/embed/abc123',
    );
  });

  it('returns an embed url with an empty id when no match is found', () => {
    expect(getYoutubeEmbedUrl('https://example.com/video')).toBe('https://www.youtube.com/embed/');
  });
});
