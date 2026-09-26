import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
  type QueryClient,
} from '@tanstack/react-query';
import {
  createRecipe,
  deleteRecipe,
  getBranchIngredients,
  getRecipeAvailability,
  getRecipes,
  updateRecipe,
  type CreateRecipePayload,
  type RecipeFilters,
  type UpdateRecipePayload,
} from '../api/recipes.api';
import type { PaginationParams } from '@/types/pagination';

export const recipesQueryKey = ['recipes'] as const;
export const branchIngredientsQueryKey = ['recipeIngredients'] as const;

export function useRecipes(pagination: PaginationParams, filters: RecipeFilters = {}) {
  return useQuery({
    queryKey: [...recipesQueryKey, pagination, filters],
    queryFn: () => getRecipes({ ...pagination, ...filters }),
    placeholderData: keepPreviousData,
  });
}

// Every recipe of one branch (for "which products already have one?"). Disabled until a branch is chosen.
export function useBranchRecipes(branchId: number | string | undefined) {
  return useQuery({
    queryKey: [...recipesQueryKey, 'branch', branchId],
    queryFn: () => getRecipes({ page: 1, limit: 100, branchId }).then((res) => res.data),
    enabled: branchId !== undefined && branchId !== '',
  });
}

// A branch's stock records, from which ingredients (and tracked products) are told apart.
export function useBranchIngredients(branchId: number | string | undefined) {
  return useQuery({
    queryKey: [...branchIngredientsQueryKey, branchId],
    queryFn: () => getBranchIngredients(branchId as number | string),
    enabled: branchId !== undefined && branchId !== '',
  });
}

export function useRecipeAvailability(id: number | string, servings: number, enabled = true) {
  return useQuery({
    queryKey: [...recipesQueryKey, 'availability', id, servings],
    queryFn: () => getRecipeAvailability(id, servings),
    enabled,
  });
}

function invalidateRecipes(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: recipesQueryKey });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRecipePayload) => createRecipe(payload),
    onSuccess: () => invalidateRecipes(queryClient),
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateRecipePayload & { id: number | string }) =>
      updateRecipe(id, payload),
    onSuccess: () => invalidateRecipes(queryClient),
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteRecipe(id),
    onSuccess: () => invalidateRecipes(queryClient),
  });
}
