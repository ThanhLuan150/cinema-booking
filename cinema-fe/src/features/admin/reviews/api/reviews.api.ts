import apiClient from 'services/apiClient';
import type { AdminReview } from '../types/adminReview.types';

export const getAdminReviews = () => apiClient.get<AdminReview[]>('/review').then((res) => res.data);

export const hideReview = (id: number | string) => apiClient.put(`/review/${id}/hide`);

export const deleteReview = (id: number | string) => apiClient.delete(`/review/${id}`);
