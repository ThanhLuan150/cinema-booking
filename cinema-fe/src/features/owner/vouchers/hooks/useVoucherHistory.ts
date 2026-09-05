import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getVoucherHistory } from '../../api/owner.api';

export function useVoucherHistory(voucherId: number | string | null, page: number, limit: number) {
  return useQuery({
    queryKey: ['voucherHistory', voucherId, page, limit],
    queryFn: () => getVoucherHistory(voucherId as number | string, { page, limit }),
    enabled: voucherId !== null,
    placeholderData: keepPreviousData,
  });
}
