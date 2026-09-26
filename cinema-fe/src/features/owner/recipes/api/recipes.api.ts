import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { Inventory, Recipe, RecipeAvailability } from '@/types/entities';

export interface RecipeFilters {
  branchId?: number | string;
  productId?: number | string;
}

export interface RecipeIngredientPayload {
  inventory_id: number;
  quantity: number;
}

export interface CreateRecipePayload {
  product_id: number;
  ingredients: RecipeIngredientPayload[];
  note?: string;
}

// The product (and so the branch) of a recipe never changes, so it is not part of an update.
export interface UpdateRecipePayload {
  ingredients?: RecipeIngredientPayload[];
  note?: string;
}

export const getRecipes = (params?: PaginationParams & RecipeFilters) =>
  apiClient.get<PaginatedResponse<Recipe>>('/recipes', { params }).then((res) => res.data);

export const createRecipe = (payload: CreateRecipePayload) =>
  apiClient.post<Recipe>('/recipes', payload).then((res) => res.data);

export const updateRecipe = (id: number | string, payload: UpdateRecipePayload) =>
  apiClient.put<Recipe>(`/recipes/${id}`, payload).then((res) => res.data);

export const deleteRecipe = (id: number | string) => apiClient.delete(`/recipes/${id}`);

// "Can N portions be made from the stock on hand?" — the same check a sale goes through.
export const getRecipeAvailability = (id: number | string, servings: number) =>
  apiClient
    .get<RecipeAvailability>(`/recipes/${id}/availability`, { params: { servings } })
    .then((res) => res.data);

// A branch's raw stock records (the API caps a page at 100). Ingredients are the ones that are not
// linked to a sellable item.
export const getBranchIngredients = (branchId: number | string) =>
  apiClient
    .get<PaginatedResponse<Inventory>>('/inventory', { params: { branchId, limit: 100 } })
    .then((res) => res.data.data);
