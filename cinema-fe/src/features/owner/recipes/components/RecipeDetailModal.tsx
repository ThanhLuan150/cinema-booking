import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/format';
import type { InventoryStatus, Recipe } from '@/types/entities';
import { useDeleteRecipe, useRecipeAvailability } from '../hooks/useRecipes';

const STATUS_VARIANT: Record<InventoryStatus, BadgeVariant> = {
  IN_STOCK: 'success',
  LOW_STOCK: 'warning',
  OUT_OF_STOCK: 'default',
};

interface RecipeDetailModalProps {
  recipe: Recipe;
  branchName?: string;
  // recipe.manage — the buttons follow it; the API enforces the same rule regardless.
  canManage: boolean;
  onEdit: (recipe: Recipe) => void;
  onClose: () => void;
}

export function RecipeDetailModal({
  recipe,
  branchName,
  canManage,
  onEdit,
  onClose,
}: RecipeDetailModalProps) {
  const { t, i18n } = useTranslation('owner');
  const deleteMutation = useDeleteRecipe();
  const [servings, setServings] = useState('1');
  const wanted = Number(servings);
  const validServings = Number.isInteger(wanted) && wanted >= 1 && wanted <= 100000;
  const { data: availability } = useRecipeAvailability(recipe.id, wanted, validServings);
  const name = recipe.product?.name ?? `#${recipe.product_id}`;

  const remove = async () => {
    if (!(await confirmDialog(t('recipes.deleteConfirm', { name })))) return;
    try {
      await deleteMutation.mutateAsync(recipe.id);
      toast.success(t('recipes.deleteSuccess'));
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={t('recipes.detailTitle', { name })} className="!max-w-3xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={recipe.can_make ? 'success' : 'default'}>
            {recipe.can_make
              ? t('recipes.canMake', { count: recipe.max_servings })
              : t('recipes.cannotMake')}
          </Badge>
          {branchName && <span className="text-sm text-txt/50">{branchName}</span>}
        </div>

        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-txt/50">
              {t('recipes.headers.price')}
            </dt>
            <dd className="text-sm">
              {recipe.product ? formatCurrency(recipe.product.price, i18n.language) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-txt/50">
              {t('recipes.headers.cost')}
            </dt>
            <dd className="text-sm">{formatCurrency(recipe.cost_per_portion, i18n.language)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-txt/50">
              {t('recipes.headers.margin')}
            </dt>
            <dd className="text-sm">
              {recipe.margin === null
                ? '—'
                : `${formatCurrency(recipe.margin, i18n.language)}${
                    recipe.margin_percent === null ? '' : ` (${recipe.margin_percent}%)`
                  }`}
            </dd>
          </div>
        </dl>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-txt/50">
              <tr>
                <th className="py-1 pr-3">{t('recipes.fields.ingredient')}</th>
                <th className="py-1 pr-3">{t('recipes.headers.perPortion')}</th>
                <th className="py-1 pr-3">{t('recipes.headers.inStock')}</th>
                <th className="py-1 pr-3">{t('recipes.headers.lineCost')}</th>
                <th className="py-1">{t('recipes.headers.status')}</th>
              </tr>
            </thead>
            <tbody>
              {recipe.ingredients.map((line) => (
                <tr key={line.inventory_id} className="border-t border-border">
                  <td className="py-1.5 pr-3">
                    {line.missing ? (
                      <span className="text-red-400">{t('recipes.missingIngredient')}</span>
                    ) : (
                      <>
                        {line.item}
                        {line.inventory_id === recipe.limiting_ingredient_id && (
                          <span className="ml-2 text-xs text-txt/50">{t('recipes.limiting')}</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    {line.quantity} {line.unit}
                  </td>
                  <td className="py-1.5 pr-3">
                    {line.stock_quantity} {line.unit}
                  </td>
                  <td className="py-1.5 pr-3">{formatCurrency(line.line_cost, i18n.language)}</td>
                  <td className="py-1.5">
                    <Badge variant={STATUS_VARIANT[line.status]}>
                      {t(`recipes.stockStatus.${line.status}`)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {recipe.note && <p className="text-sm text-txt/70">{recipe.note}</p>}

        <div className="rounded-md border border-border p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <Input
                id="recipe-servings"
                type="number"
                label={t('recipes.availability.servings')}
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
            {validServings && availability && (
              <p
                className={`pb-2 text-sm ${availability.can_make ? 'text-green-500' : 'text-red-400'}`}
                role="status"
              >
                {availability.can_make
                  ? t('recipes.availability.ok', { count: availability.servings })
                  : t('recipes.availability.short', {
                      items: availability.shortages
                        .map((s) => `${s.item} (${s.available}/${s.requested} ${s.unit ?? ''})`)
                        .join(', '),
                    })}
              </p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={() => onEdit(recipe)}>
              {t('recipes.edit')}
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={remove}
            >
              {t('recipes.delete')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
