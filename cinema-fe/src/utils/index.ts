export function getImageUrl(path?: string | null): string {
  if (!path) return '';
  return /^https?:\/\//i.test(path) ? path : `/picture/${path}`;
}

export function getMoviePosterUrl(avatar?: string | null): string {
  return getImageUrl(avatar);
}

export type TrailerKind = 'youtube' | 'video' | 'image' | null;

export function getTrailerKind(url?: string | null): TrailerKind {
  if (!url) return null;
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/\/video\/upload\//i.test(url) || /\.(mp4|webm|ogg|mov|m4v)$/i.test(url)) return 'video';
  return 'image';
}

export function getYoutubeEmbedUrl(url: string): string {
  const videoId = url.match(/[?&]v=([^&]+)/)?.[1] ?? url.match(/youtu\.be\/([^?&]+)/)?.[1] ?? '';
  return `https://www.youtube.com/embed/${videoId}`;
}
