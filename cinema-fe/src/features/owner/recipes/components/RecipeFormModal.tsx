import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { useComboComponents } from '@/features/owner/hooks/useComboComponents';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/format';
import type { Recipe } from '@/types/entities';
import {
  useBranchIngredients,
  useBranchRecipes,
  useCreateRecipe,
  useUpdateRecipe,
} from '../hooks/useRecipes';
import {
  MAX_INGREDIENTS,
  emptyRecipeForm,
  newLine,
  previewRecipe,
  recipeToForm,
  toCreatePayload,
  toIngredientPayload,
  validateRecipeForm,
  type IngredientDraft,
  type RecipeForm,
  type RecipeFormErrors,
} from '../recipeForm';

interface RecipeFormModalProps {
  // null = a new recipe; a recipe = edit its ingredients and note.
  editing: Recipe | null;
  cinemas: { id: number; name: string }[];
  onClose: () => void;
  onSaved?: (recipe: Recipe) => void;
}

export function RecipeFormModal({ editing, cinemas, onClose, onSaved }: RecipeFormModalProps) {
  const { t, i18n } = useTranslation('owner');
  const [form, setForm] = useState<RecipeForm>(() =>
    editing
      ? recipeToForm(editing)
      : emptyRecipeForm(cinemas.length === 1 ? String(cinemas[0].id) : ''),
  );
  const [showErrors, setShowErrors] = useState(false);

  const branchId = form.branch_id || undefined;
  const { data: stock = [] } = useBranchIngredients(branchId);
  const { data: components } = useComboComponents(editing ? undefined : branchId);
  const { data: branchRecipes = [] } = useBranchRecipes(editing ? undefined : branchId);

  // Ingredients are raw stock; a record linked to a sellable item is that item's own count.
  const ingredients = useMemo(() => stock.filter((item) => item.combo_id === null), [stock]);
  const inventoryById = useMemo(() => new Map(stock.map((item) => [item.id, item])), [stock]);

  // Products that can still take a recipe: FOOD/BEVERAGE, no recipe yet, not counted directly.
  const productOptions = useMemo(() => {
    const withRecipe = new Set(branchRecipes.map((recipe) => recipe.product_id));
    const tracked = new Set(stock.map((item) => item.combo_id).filter((id) => id !== null));
    return (components?.data ?? [])
      .filter((p) => p.type !== 'COMBO' && !withRecipe.has(p.id) && !tracked.has(p.id))
      .map((p) => ({ label: p.name, value: p.id }));
  }, [components, branchRecipes, stock]);
  const selectedProduct = (components?.data ?? []).find((p) => String(p.id) === form.product_id);
  const price = editing ? (editing.product?.price ?? null) : (selectedProduct?.price ?? null);

  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe();
  const errors: RecipeFormErrors = showErrors
    ? validateRecipeForm(form, { editing: !!editing })
    : {};
  const errorText = (key?: string) => (key ? t(`recipes.validation.${key}`) : undefined);
  const preview = previewRecipe(form.lines, inventoryById, price);

  const set = <K extends keyof RecipeForm>(key: K, value: RecipeForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setLine = (key: number, patch: Partial<IngredientDraft>) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));
  const removeLine = (key: number) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.length > 1 ? f.lines.filter((line) => line.key !== key) : f.lines,
    }));

  // Stock is per branch: switching branch invalidates the product and every ingredient chosen.
  const changeBranch = (value: string) =>
    setForm((f) => ({ ...f, branch_id: value, product_id: '', lines: [newLine()] }));

  const optionsFor = (line: IngredientDraft) =>
    ingredients
      .filter(
        (item) =>
          String(item.id) === line.inventory_id ||
          !form.lines.some((l) => l.inventory_id === String(item.id)),
      )
      .map((item) => ({
        label: `${item.item}${item.sku ? ` · ${item.sku}` : ''} (${item.unit})`,
        value: item.id,
      }));

  const submit = async () => {
    setShowErrors(true);
    if (Object.keys(validateRecipeForm(form, { editing: !!editing })).length > 0) return;
    try {
      let saved: Recipe;
      if (editing) {
        saved = await updateMutation.mutateAsync({
          id: editing.id,
          ingredients: toIngredientPayload(form),
          note: form.note.trim(),
        });
        toast.success(t('recipes.updateSuccess'));
      } else {
        saved = await createMutation.mutateAsync(toCreatePayload(form));
        toast.success(t('recipes.createSuccess'));
      }
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const limiting = preview.limitingId ? inventoryById.get(preview.limitingId) : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      title={
        editing
          ? t('recipes.editTitle', { name: editing.product?.name ?? `#${editing.product_id}` })
          : t('recipes.addTitle')
      }
      className="!max-w-3xl"
    >
      <div className="space-y-3">
        {editing ? (
          <p className="text-sm text-txt/70">
            {t('recipes.fields.product')}:{' '}
            <span className="font-medium text-txt">
              {editing.product?.name ?? `#${editing.product_id}`}
            </span>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              id="recipe-branch"
              label={t('recipes.fields.branch')}
              placeholder={t('recipes.fields.branchPlaceholder')}
              value={form.branch_id}
              options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
              onChange={(e) => changeBranch(e.target.value)}
              error={errorText(errors.branch_id)}
            />
            <Select
              id="recipe-product"
              label={t('recipes.fields.product')}
              placeholder={t('recipes.fields.productPlaceholder')}
              value={form.product_id}
              disabled={!form.branch_id}
              options={productOptions}
              onChange={(e) => set('product_id', e.target.value)}
              error={errorText(errors.product_id)}
            />
          </div>
        )}
        {!editing && form.branch_id && productOptions.length === 0 && (
          <p className="text-xs text-txt/50">{t('recipes.noEligibleProducts')}</p>
        )}

        <div>
          <h3 className="mb-1 text-sm font-semibold text-txt/90">
            {t('recipes.ingredientsTitle')}
          </h3>
          <p className="mb-2 text-xs text-txt/50">{t('recipes.perPortionHint')}</p>
          {!form.branch_id ? (
            <p className="text-sm text-txt/60">{t('recipes.pickBranchFirst')}</p>
          ) : (
            <div className="space-y-2">
              {form.lines.map((line) => {
                const item = inventoryById.get(Number(line.inventory_id));
                return (
                  <div key={line.key} className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-12 sm:col-span-6">
                      <Select
                        aria-label={t('recipes.fields.ingredient')}
                        placeholder={t('recipes.fields.ingredientPlaceholder')}
                        value={line.inventory_id}
                        options={optionsFor(line)}
                        onChange={(e) => setLine(line.key, { inventory_id: e.target.value })}
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <Input
                        type="number"
                        step="any"
                        aria-label={t('recipes.fields.quantity')}
                        placeholder={t('recipes.fields.quantity')}
                        value={line.quantity}
                        onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="col-span-4 pb-2.5 text-sm text-txt/70 sm:col-span-2">
                      {item ? item.unit : ''}
                    </div>
                    <button
                      type="button"
                      aria-label={t('recipes.removeLine')}
                      disabled={form.lines.length === 1}
                      className="col-span-2 pb-2.5 text-red-500 hover:text-red-400 disabled:opacity-30 sm:col-span-1"
                      onClick={() => removeLine(line.key)}
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
              {errors.lines && <p className="text-sm text-red-400">{errorText(errors.lines)}</p>}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={form.lines.length >= Math.min(ingredients.length, MAX_INGREDIENTS)}
                onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, newLine()] }))}
              >
                {t('recipes.addLine')}
              </Button>
              {ingredients.length === 0 && (
                <p className="text-xs text-txt/50">{t('recipes.noIngredients')}</p>
              )}
            </div>
          )}
        </div>

        <Input
          id="recipe-note"
          label={t('recipes.fields.note')}
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          error={errorText(errors.note)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm text-txt/70">
            <div>
              <dt className="text-xs uppercase tracking-wide text-txt/50">
                {t('recipes.preview.cost')}
              </dt>
              <dd className="font-semibold text-txt">
                {formatCurrency(preview.cost, i18n.language)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-txt/50">
                {t('recipes.preview.margin')}
              </dt>
              <dd className="font-semibold text-txt">
                {preview.margin === null
                  ? '—'
                  : `${formatCurrency(preview.margin, i18n.language)}${
                      preview.marginPercent === null ? '' : ` (${preview.marginPercent}%)`
                    }`}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-txt/50">
                {t('recipes.preview.maxServings')}
              </dt>
              <dd className="font-semibold text-txt">
                {preview.maxServings === null
                  ? '—'
                  : `${preview.maxServings}${limiting ? ` · ${limiting.item}` : ''}`}
              </dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="danger"
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={submit}
          >
            {t('recipes.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
