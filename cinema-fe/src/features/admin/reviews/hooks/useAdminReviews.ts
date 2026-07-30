import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getAdminReviews } from '../api/reviews.api';

export const adminReviewsQueryKey = ['adminReviews'] as const;

export function useAdminReviews(page: number, limit: number) {
  return useQuery({
    queryKey: [...adminReviewsQueryKey, page, limit],
    queryFn: () => getAdminReviews({ page, limit }),
    placeholderData: keepPreviousData,
  });
}
