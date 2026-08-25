import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getComboOrders } from '../api/comboOrder.api';
import type { ComboOrderListParams } from '../types/comboOrder.types';

export const comboOrdersQueryKey = ['comboOrders'] as const;

export function useComboOrders(params: ComboOrderListParams) {
  return useQuery({
    queryKey: [...comboOrdersQueryKey, params],
    queryFn: () => getComboOrders(params),
    placeholderData: keepPreviousData,
  });
}
