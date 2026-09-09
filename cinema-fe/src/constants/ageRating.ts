// Vietnam cinema age-rating labels (Thông tư 05/2023/BVHTTDL). Mirrors Movie.AGE_RATINGS on
// the backend — keep the two lists in sync.
export const AGE_RATINGS = ['P', 'K', 'T13', 'T16', 'T18', 'C'] as const;

export type AgeRating = (typeof AGE_RATINGS)[number];

export const DEFAULT_AGE_RATING: AgeRating = 'P';
