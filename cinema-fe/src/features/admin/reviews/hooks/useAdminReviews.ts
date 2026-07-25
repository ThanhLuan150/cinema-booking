import { useQuery } from '@tanstack/react-query';
import { getAdminReviews } from '../api/reviews.api';

export const adminReviewsQueryKey = ['adminReviews'] as const;

export function useAdminReviews() {
  return useQuery({
    queryKey: adminReviewsQueryKey,
    queryFn: getAdminReviews,
  });
}
