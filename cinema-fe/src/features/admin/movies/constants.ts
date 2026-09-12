import { AGE_RATINGS, DEFAULT_AGE_RATING } from '@/constants/ageRating';
import type { AddMovieFormValues, EditMovieFormValues } from './types/adminMovie.types';

export const AGE_RATING_OPTIONS = AGE_RATINGS.map((value) => ({ label: value, value }));

export const emptyAddMovieValues = (): AddMovieFormValues => ({
  name: '',
  avatar: '',
  duration: '',
  premiere_date: '',
  description: '',
  country: '',
  trailer: '',
  producer: '',
  producerAvatar: '',
  banner: '',
  gallery: [],
  age_rating: DEFAULT_AGE_RATING,
  language: '',
  subtitle: '',
  featured: false,
  categoryIds: [],
  directorIds: [],
  actors: [],
});

export const emptyEditMovieValues = (): EditMovieFormValues => ({
  name: '',
  avatar: '',
  duration: '',
  premiere_date: '',
  description: '',
  country: '',
  trailer: '',
  producer: '',
  producerAvatar: '',
  status: 'ACTIVE',
  banner: '',
  gallery: [],
  age_rating: DEFAULT_AGE_RATING,
  language: '',
  subtitle: '',
  featured: false,
  categoryIds: [],
  directorIds: [],
  actors: [],
});
