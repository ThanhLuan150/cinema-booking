import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getGiftCardHistory } from '../api/giftCard.api';

export function useGiftCardHistory(giftCardId: number | null, page: number, limit: number) {
  return useQuery({
    queryKey: ['giftCardHistory', giftCardId, page, limit],
    queryFn: () => getGiftCardHistory(giftCardId as number, page, limit),
    enabled: giftCardId !== null,
    placeholderData: keepPreviousData,
  });
}
