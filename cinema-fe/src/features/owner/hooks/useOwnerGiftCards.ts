import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getOwnerGiftCards } from '../api/owner.api';

export const ownerGiftCardsQueryKey = ['ownerGiftCards'] as const;

export function useOwnerGiftCards(page: number, limit: number) {
  return useQuery({
    queryKey: [...ownerGiftCardsQueryKey, page, limit],
    queryFn: () => getOwnerGiftCards(undefined, { page, limit }),
    placeholderData: keepPreviousData,
  });
}
