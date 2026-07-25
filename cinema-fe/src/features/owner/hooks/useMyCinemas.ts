import { useQuery } from '@tanstack/react-query';
import { getMyCinemas } from '../api/owner.api';

export const myCinemasQueryKey = ['myCinemas'] as const;

export function useMyCinemas() {
  return useQuery({
    queryKey: myCinemasQueryKey,
    queryFn: getMyCinemas,
  });
}
