import { useMutation, useQueryClient } from '@tanstack/react-query';
import { favoriteCinema } from '../api/movies.api';
import { favoriteCinemasQueryKey } from './useFavoriteCinemas';

export function useFavoriteCinemaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: number) => favoriteCinema(branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteCinemasQueryKey });
    },
  });
}
