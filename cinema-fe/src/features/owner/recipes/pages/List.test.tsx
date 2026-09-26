import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import type { Recipe } from '@/types/entities';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts && 'count' in opts ? `${key} ${opts.count}` : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: undefined }),
}));
let grantedPermissions: Set<string> | null = null; // null = grant everything (Branch Admin)
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: (code: string) => grantedPermissions === null || grantedPermissions.has(code),
  }),
}));

const useMyCinemasMock = vi.fn();
vi.mock('@/features/owner/hooks/useMyCinemas', () => ({
  useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args),
}));
vi.mock('@/features/owner/hooks/useComboComponents', () => ({
  useComboComponents: () => ({
    data: {
      data: [
        { id: 10, cinema_id: 1, name: 'Large Popcorn', price: 50000, type: 'FOOD' },
        { id: 11, cinema_id: 1, name: 'Nachos', price: 60000, type: 'FOOD' },
        { id: 12, cinema_id: 1, name: 'Combo', price: 70000, type: 'COMBO' },
      ],
    },
  }),
}));

const useRecipesMock = vi.fn();
const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();
vi.mock('../hooks/useRecipes', () => ({
  useRecipes: (...args: unknown[]) => useRecipesMock(...args),
  useBranchRecipes: () => ({ data: [{ product_id: 11 }] }), // Nachos already has a recipe
  useBranchIngredients: () => ({
    data: [
      {
        id: 1,
        item: 'Corn',
        sku: 'CORN',
        unit: 'g',
        quantity: 1000,
        cost_price: 0.05,
        combo_id: null,
      },
      {
        id: 2,
        item: 'Butter',
        sku: null,
        unit: 'g',
        quantity: 100,
        cost_price: 0.4,
        combo_id: null,
      },
      { id: 3, item: 'Coke', sku: null, unit: 'can', quantity: 40, cost_price: 0, combo_id: 99 },
    ],
  }),
  useRecipeAvailability: () => ({ data: undefined }),
  useCreateRecipe: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateRecipe: () => ({ mutateAsync: updateMutate, isPending: false }),
  useDeleteRecipe: () => ({ mutateAsync: deleteMutate, isPending: false }),
}));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/features/notifications/toast', () => ({ toast: toastMock }));
const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({
  confirmDialog: (...args: unknown[]) => confirmDialogMock(...args),
}));

import RecipesList from './List';

const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 1,
  branch_id: 1,
  product_id: 10,
  product: { id: 10, name: 'Large Popcorn', type: 'FOOD', price: 50000, active: true },
  ingredients: [
    {
      inventory_id: 1,
      quantity: 150,
      missing: false,
      item: 'Corn',
      sku: 'CORN',
      unit: 'g',
      cost_price: 0.05,
      line_cost: 7.5,
      stock_quantity: 1000,
      minimum_quantity: 100,
      status: 'IN_STOCK',
    },
    {
      inventory_id: 2,
      quantity: 20,
      missing: false,
      item: 'Butter',
      sku: null,
      unit: 'g',
      cost_price: 0.4,
      line_cost: 8,
      stock_quantity: 100,
      minimum_quantity: 10,
      status: 'LOW_STOCK',
    },
  ],
  note: '',
  cost_per_portion: 15.5,
  margin: 49984.5,
  margin_percent: 99.97,
  max_servings: 5,
  limiting_ingredient_id: 2,
  can_make: true,
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
  ...overrides,
});

function renderPage() {
  const store = configureStore({ reducer: { auth: (s = {}) => s } });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <RecipesList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

const listOf = (...recipes: Recipe[]) =>
  useRecipesMock.mockReturnValue({ data: { data: recipes, totalPages: 1 }, isLoading: false });
const pick = (control: HTMLElement, optionText: string | RegExp) => {
  fireEvent.click(control);
  fireEvent.click(within(screen.getByRole('listbox')).getByText(optionText));
};
const hasButton = (key: string) =>
  screen.queryByRole('button', { name: `recipes.${key}` }) !== null;

describe('Owner Recipes list', () => {
  beforeEach(() => {
    grantedPermissions = null;
    [
      useRecipesMock,
      useMyCinemasMock,
      createMutate,
      updateMutate,
      deleteMutate,
      confirmDialogMock,
    ].forEach((m) => m.mockReset());
    toastMock.success.mockReset();
    toastMock.error.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Branch A' }] } });
  });

  it('lists each recipe with its cost, margin and how many portions can be made', () => {
    listOf(recipe());
    renderPage();
    expect(screen.getByText('Large Popcorn')).toBeInTheDocument();
    expect(screen.getByText('Branch A')).toBeInTheDocument();
    expect(screen.getByText('99.97%')).toBeInTheDocument();
    expect(screen.getByText('recipes.canMake 5')).toBeInTheDocument();
  });

  it('marks a recipe whose ingredients ran out', () => {
    listOf(recipe({ can_make: false, max_servings: 0 }));
    renderPage();
    expect(screen.getByText('recipes.cannotMake')).toBeInTheDocument();
  });

  it('shows the empty message when there are no recipes', () => {
    listOf();
    renderPage();
    expect(screen.getByText('recipes.empty')).toBeInTheDocument();
  });

  describe('permissions', () => {
    it('a manager sees the add button and edit/delete in the detail', () => {
      listOf(recipe());
      renderPage();
      expect(hasButton('addButton')).toBe(true);
      fireEvent.click(screen.getByText('recipes.view'));
      expect(hasButton('edit')).toBe(true);
      expect(hasButton('delete')).toBe(true);
    });

    it('a read-only user (recipe.read without recipe.manage) can look but not change anything', () => {
      grantedPermissions = new Set(['recipe.read']);
      listOf(recipe());
      renderPage();
      expect(hasButton('addButton')).toBe(false);
      fireEvent.click(screen.getByText('recipes.view'));
      expect(screen.getByText('Corn')).toBeInTheDocument(); // the ingredients are readable
      expect(hasButton('edit')).toBe(false);
      expect(hasButton('delete')).toBe(false);
    });
  });

  describe('viewing a recipe', () => {
    it('shows every ingredient with its per-portion quantity, stock and status, flagging the limiting one', () => {
      listOf(recipe());
      renderPage();
      fireEvent.click(screen.getByText('recipes.view'));
      expect(screen.getByText('Corn')).toBeInTheDocument();
      expect(screen.getByText('150 g')).toBeInTheDocument();
      expect(screen.getByText('recipes.stockStatus.LOW_STOCK')).toBeInTheDocument();
      expect(screen.getByText('recipes.limiting')).toBeInTheDocument();
    });

    it('flags an ingredient whose stock record no longer exists', () => {
      const base = recipe();
      listOf(
        recipe({
          ingredients: [{ ...base.ingredients[0], missing: true, item: null, unit: null }],
          can_make: false,
          max_servings: 0,
        }),
      );
      renderPage();
      fireEvent.click(screen.getByText('recipes.view'));
      expect(screen.getByText('recipes.missingIngredient')).toBeInTheDocument();
    });

    it('deletes a recipe after confirmation, and not when the confirmation is declined', async () => {
      listOf(recipe());
      renderPage();
      fireEvent.click(screen.getByText('recipes.view'));

      confirmDialogMock.mockResolvedValueOnce(false);
      fireEvent.click(screen.getByRole('button', { name: 'recipes.delete' }));
      await waitFor(() => expect(confirmDialogMock).toHaveBeenCalledTimes(1));
      expect(deleteMutate).not.toHaveBeenCalled();

      confirmDialogMock.mockResolvedValueOnce(true);
      deleteMutate.mockResolvedValueOnce(undefined);
      fireEvent.click(screen.getByRole('button', { name: 'recipes.delete' }));
      await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(1));
      expect(toastMock.success).toHaveBeenCalledWith('recipes.deleteSuccess');
    });

    it('surfaces the server error when a delete fails', async () => {
      listOf(recipe());
      renderPage();
      fireEvent.click(screen.getByText('recipes.view'));
      confirmDialogMock.mockResolvedValueOnce(true);
      deleteMutate.mockRejectedValueOnce({ response: { data: { message: 'nope' } } });
      fireEvent.click(screen.getByRole('button', { name: 'recipes.delete' }));
      await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('nope'));
    });
  });

  describe('creating a recipe', () => {
    const openForm = () =>
      fireEvent.click(screen.getByRole('button', { name: 'recipes.addButton' }));

    it('does not offer "new recipe" when the user has no branch to pick', () => {
      useMyCinemasMock.mockReturnValue({ data: { data: [] } });
      listOf();
      renderPage();
      expect(hasButton('addButton')).toBe(false);
    });

    it('validates before calling the server', async () => {
      listOf();
      renderPage();
      openForm();
      fireEvent.click(screen.getByRole('button', { name: 'recipes.save' }));
      expect(await screen.findByText('recipes.validation.productRequired')).toBeInTheDocument();
      expect(screen.getByText('recipes.validation.linesRequired')).toBeInTheDocument();
      expect(createMutate).not.toHaveBeenCalled();
    });

    it('offers only eligible products and only raw-stock ingredients', () => {
      listOf();
      renderPage();
      openForm();
      const productSelect = screen.getByLabelText('recipes.fields.product');
      fireEvent.click(productSelect);
      const productNames = within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((o) => o.textContent);
      expect(productNames).toContain('Large Popcorn');
      expect(productNames).not.toContain('Nachos'); // already has a recipe
      expect(productNames).not.toContain('Combo'); // a bundle has no recipe
      fireEvent.click(productSelect); // close it again

      fireEvent.click(screen.getByLabelText('recipes.fields.ingredient'));
      const ingredientNames = within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((o) => o.textContent);
      expect(ingredientNames.some((n) => n?.startsWith('Corn'))).toBe(true);
      expect(ingredientNames.some((n) => n?.startsWith('Coke'))).toBe(false); // a tracked product, not an ingredient
    });

    const fillValidRecipe = () => {
      pick(screen.getByLabelText('recipes.fields.product'), 'Large Popcorn');
      pick(screen.getByLabelText('recipes.fields.ingredient'), /Corn/);
      fireEvent.change(screen.getByLabelText('recipes.fields.quantity'), {
        target: { value: '150' },
      });
    };

    it('submits the product and ingredient quantities, and previews cost and portions live', async () => {
      listOf();
      createMutate.mockResolvedValueOnce(recipe());
      renderPage();
      openForm();
      fillValidRecipe();

      // 1000 g of corn / 150 g per portion = 6 portions, limited by corn
      expect(screen.getByText('6 · Corn')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'recipes.save' }));
      await waitFor(() =>
        expect(createMutate).toHaveBeenCalledWith({
          product_id: 10,
          ingredients: [{ inventory_id: 1, quantity: 150 }],
          note: '',
        }),
      );
      expect(toastMock.success).toHaveBeenCalledWith('recipes.createSuccess');
    });

    it('shows the server error and keeps the form open', async () => {
      listOf();
      createMutate.mockRejectedValueOnce({
        response: { data: { code: 'RECIPE_ALREADY_EXISTS', message: 'dup' } },
      });
      renderPage();
      openForm();
      fillValidRecipe();
      fireEvent.click(screen.getByRole('button', { name: 'recipes.save' }));
      await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
      expect(screen.getByRole('button', { name: 'recipes.save' })).toBeInTheDocument();
    });
  });
});
