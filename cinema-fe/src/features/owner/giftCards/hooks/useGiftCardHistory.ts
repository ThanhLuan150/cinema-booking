import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getGiftCardHistory } from '../../api/owner.api';

export function useGiftCardHistory(giftCardId: number | string | null, page: number, limit: number) {
  return useQuery({
    queryKey: ['giftCardHistory', giftCardId, page, limit],
    queryFn: () => getGiftCardHistory(giftCardId as number | string, { page, limit }),
    enabled: giftCardId !== null,
    placeholderData: keepPreviousData,
  });
}
