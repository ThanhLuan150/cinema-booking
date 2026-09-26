import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { usePermissions } from '@/hooks/usePermissions';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { formatCurrency } from '@/lib/format';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { Recipe } from '@/types/entities';
import { RecipeDetailModal } from '../components/RecipeDetailModal';
import { RecipeFormModal } from '../components/RecipeFormModal';
import { useRecipes } from '../hooks/useRecipes';

function RecipesList() {
  const { t, i18n } = useTranslation('owner');
  const { hasPermission } = usePermissions();
  // recipe.read shows the page; recipe.manage adds the buttons. An Employee holds neither by
  // default, so kitchen staff may be given read alone.
  const canManage = hasPermission('recipe.manage');

  const [page, setPage] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [formRecipe, setFormRecipe] = useState<Recipe | null | undefined>(undefined); // undefined = closed

  // Only a Branch Admin/Super Admin can list branches; a staffed Employee just gets their branch's rows.
  const { data: cinemasPage } = useMyCinemas({ enabled: hasPermission('branch.read') });
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const cinemaNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  const { data, isLoading } = useRecipes(
    { page, limit: DEFAULT_PAGE_SIZE },
    { branchId: branchId || undefined },
  );
  const recipes = data?.data ?? [];
  // The open recipe shows whichever copy is newer: the list's (a realtime update or a stock change,
  // once it refetches) or the one a mutation just returned. Falls back to the last known copy when
  // a filter no longer includes it.
  const listed = selected ? recipes.find((r) => r.id === selected.id) : undefined;
  const current = selected && listed && listed.updatedAt >= selected.updatedAt ? listed : selected;

  return (
    <AdminLayout breadcrumb={t('recipes.breadcrumb')} loading={isLoading}>
      {canManage && cinemas.length > 0 && (
        <Button type="button" variant="danger" onClick={() => setFormRecipe(null)}>
          {t('recipes.addButton')}
        </Button>
      )}

      {cinemas.length > 1 && (
        <div className="mt-4 max-w-xs">
          <Select
            aria-label={t('recipes.filters.branchLabel')}
            value={branchId}
            options={[
              { label: t('recipes.filters.allBranches'), value: '' },
              ...cinemas.map((c) => ({ label: c.name, value: c.id })),
            ]}
            onChange={(e) => {
              setBranchId(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('recipes.headers.product'),
            t('recipes.headers.branch'),
            t('recipes.headers.ingredients'),
            t('recipes.headers.cost'),
            t('recipes.headers.margin'),
            t('recipes.headers.availability'),
            t('recipes.headers.actions'),
          ]}
          emptyMessage={t('recipes.empty')}
        >
          {recipes.map((recipe) => (
            <tr key={recipe.id}>
              <td className="font-medium">{recipe.product?.name ?? `#${recipe.product_id}`}</td>
              <td>{cinemaNameById.get(recipe.branch_id) ?? `#${recipe.branch_id}`}</td>
              <td>{recipe.ingredients.length}</td>
              <td>{formatCurrency(recipe.cost_per_portion, i18n.language)}</td>
              <td>{recipe.margin_percent === null ? '—' : `${recipe.margin_percent}%`}</td>
              <td>
                <Badge variant={recipe.can_make ? 'success' : 'default'}>
                  {recipe.can_make
                    ? t('recipes.canMake', { count: recipe.max_servings })
                    : t('recipes.cannotMake')}
                </Badge>
              </td>
              <td>
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => setSelected(recipe)}
                >
                  {t('recipes.view')}
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>

      {current && (
        <RecipeDetailModal
          recipe={current}
          branchName={cinemaNameById.get(current.branch_id)}
          canManage={canManage}
          onEdit={(recipe) => {
            setSelected(null);
            setFormRecipe(recipe);
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {canManage && formRecipe !== undefined && (
        <RecipeFormModal
          editing={formRecipe}
          cinemas={cinemas}
          onSaved={setSelected}
          onClose={() => setFormRecipe(undefined)}
        />
      )}
    </AdminLayout>
  );
}

export default RecipesList;
