import apiClient from 'services/apiClient';
import type { MovieReviewPayload, ReviewsResponse } from '../types/movieDetail.types';

export const getMovieReviews = (movieId: string | number) =>
  apiClient.get<ReviewsResponse>(`/review/${movieId}`).then((res) => res.data);

export const postMovieReview = (payload: MovieReviewPayload) => apiClient.post('/review', payload);
