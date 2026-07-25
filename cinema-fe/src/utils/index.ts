export function getImageUrl(path?: string | null): string {
  if (!path) return '';
  return /^https?:\/\//i.test(path) ? path : `/picture/${path}`;
}

export function getMoviePosterUrl(avatar?: string | null): string {
  return getImageUrl(avatar);
}
