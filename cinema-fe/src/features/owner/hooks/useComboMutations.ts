import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCombo, deleteCombo, updateCombo } from '../api/owner.api';
import { ownerCombosQueryKey } from './useOwnerCombos';
import type { ComboFormValues } from '../types/owner.types';

export function useCreateCombo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ComboFormValues) =>
      createCombo({
        cinema_id: Number(payload.cinema_id),
        name: payload.name,
        description: payload.description,
        price: Number(payload.price),
        type: payload.type,
        items:
          payload.type === 'COMBO'
            ? Object.entries(payload.items)
                .filter(([, quantity]) => quantity > 0)
                .map(([itemId, quantity]) => ({ item_id: Number(itemId), quantity }))
            : [],
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerCombosQueryKey }),
  });
}

export function useUpdateCombo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number | string; active: boolean }) => updateCombo(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerCombosQueryKey }),
  });
}

export function useDeleteCombo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteCombo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerCombosQueryKey }),
  });
}
