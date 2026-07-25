import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteReview, hideReview } from '../api/reviews.api';
import { adminReviewsQueryKey } from './useAdminReviews';

export function useHideReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => hideReview(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminReviewsQueryKey }),
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteReview(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminReviewsQueryKey }),
  });
}
