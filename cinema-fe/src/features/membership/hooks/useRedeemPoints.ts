import { useMutation, useQueryClient } from '@tanstack/react-query';
import { redeemPoints } from '../api/membership.api';
import { myMembershipQueryKey } from './useMyMembership';
import { myPointsHistoryQueryKey } from './useMyPointsHistory';

export function useRedeemPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ points, description }: { points: number; description?: string }) => redeemPoints(points, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myMembershipQueryKey });
      queryClient.invalidateQueries({ queryKey: myPointsHistoryQueryKey });
    },
  });
}
