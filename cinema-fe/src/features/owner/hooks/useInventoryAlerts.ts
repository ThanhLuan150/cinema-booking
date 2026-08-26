import { useQuery } from '@tanstack/react-query';
import { getInventoryAlerts } from '../api/owner.api';

export const inventoryAlertsQueryKey = ['inventoryAlerts'] as const;

export function useInventoryAlerts() {
  return useQuery({
    queryKey: inventoryAlertsQueryKey,
    queryFn: () => getInventoryAlerts(),
  });
}
