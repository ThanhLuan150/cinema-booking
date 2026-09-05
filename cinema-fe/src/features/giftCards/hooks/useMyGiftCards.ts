import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMyGiftCards } from '../api/giftCard.api';

export const myGiftCardsQueryKey = ['myGiftCards'] as const;

export function useMyGiftCards(page: number, limit: number) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: [...myGiftCardsQueryKey, page, limit],
    queryFn: () => getMyGiftCards(page, limit),
    enabled: isAuthenticated,
    placeholderData: keepPreviousData,
  });
}
