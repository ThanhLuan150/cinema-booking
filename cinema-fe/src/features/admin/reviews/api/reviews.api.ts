import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { AdminReview } from '../types/adminReview.types';

export const getAdminReviews = (params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<AdminReview>>('/review', { params }).then((res) => res.data);

export const hideReview = (id: number | string) => apiClient.put(`/review/${id}/hide`);

export const deleteReview = (id: number | string) => apiClient.delete(`/review/${id}`);
