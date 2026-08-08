import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unfavoriteCinema } from '../api/movies.api';
import { favoriteCinemasQueryKey } from './useFavoriteCinemas';

export function useUnfavoriteCinemaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: number) => unfavoriteCinema(branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteCinemasQueryKey });
    },
  });
}
