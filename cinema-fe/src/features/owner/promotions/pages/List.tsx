import { useCallback, useMemo, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { ROLES } from '@/constants/roles';
import { PROMOTION_DISCOUNT_TYPE } from '@/constants/promotionDiscountType';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { Promotion } from '@/types/entities';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerCombos } from '../../hooks/useOwnerCombos';
import { useOwnerPromotions } from '../../hooks/useOwnerPromotions';
import { useCreatePromotion, useDeletePromotion, useUpdatePromotion } from '../../hooks/usePromotionMutations';
import { closeAddModal, openAddModal, closeEditModal, openEditModal } from '../../store/ownerPromotionsSlice';
import type { PromotionPayload } from '../../api/owner.api';
import type { PromotionFormValues } from '../../types/owner.types';
import { ALL_BRANCHES } from '../constants';
import { AddPromotionModal } from '../components/AddPromotionModal';
import { EditPromotionModal } from '../components/EditPromotionModal';
import { PromotionsTable } from '../components/PromotionsTable';

function toPromotionPayload(values: PromotionFormValues): PromotionPayload {
  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    description: values.description.trim(),
    discount_type: values.discount_type,
    discount_value: Number(values.discount_value),
    minimum_order_value: values.minimum_order_value === '' ? 0 : Number(values.minimum_order_value),
    maximum_discount: values.maximum_discount === '' ? null : Number(values.maximum_discount),
    start_at: values.start_at,
    end_at: values.end_at,
    usage_limit: values.usage_limit === '' ? null : Number(values.usage_limit),
    per_customer_limit: values.per_customer_limit === '' ? null : Number(values.per_customer_limit),
    branch_ids: values.branch_id === ALL_BRANCHES ? [] : values.branch_id ? [Number(values.branch_id)] : [],
    movie_ids: values.movie_id ? [Number(values.movie_id)] : [],
    combo_ids: values.combo_id ? [Number(values.combo_id)] : [],
  };
}

function PromotionList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const isAdmin = useAuthRole() === ROLES.admin;

  const [page, setPage] = useState(1);

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data: moviesPage } = useMovies(undefined, { page: 1, limit: 100 });
  const movies = useMemo(() => moviesPage?.data ?? [], [moviesPage]);
  const { data: combosPage } = useOwnerCombos(1, 100);
  const combos = useMemo(() => combosPage?.data ?? [], [combosPage]);

  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);
  const movieNameById = useMemo(() => new Map(movies.map((m) => [m.id, m.name])), [movies]);
  const comboNameById = useMemo(() => new Map(combos.map((c) => [c.id, c.name])), [combos]);

  const defaultBranchId = isAdmin ? '' : cinemas.length > 0 ? String(cinemas[0].id) : '';

  const { data, isLoading } = useOwnerPromotions(undefined, page, DEFAULT_PAGE_SIZE);
  const promotions = useMemo(() => data?.data ?? [], [data]);
  const { showAddModal, editingPromotionId } = useAppSelector((state) => state.ownerPromotions);
  const editingPromotion = useMemo(
    () => promotions.find((p) => p.id === editingPromotionId) ?? null,
    [promotions, editingPromotionId],
  );

  const createPromotionMutation = useCreatePromotion();
  const updatePromotionMutation = useUpdatePromotion();
  const deletePromotionMutation = useDeletePromotion();

  const toggleActive = useCallback(
    async (promotion: Promotion) => {
      try {
        await updatePromotionMutation.mutateAsync({
          id: promotion.id,
          status: promotion.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        });
      } catch (error) {
        console.error(error);
      }
    },
    [updatePromotionMutation],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('promotions.deleteConfirm')))) return;
      try {
        await deletePromotionMutation.mutateAsync(id);
        toast.success(t('promotions.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deletePromotionMutation, t],
  );

  const validatePromotion = useCallback(
    (values: PromotionFormValues) => {
      const errors: Partial<Record<keyof PromotionFormValues, string>> = {};
      if (!values.code.trim()) errors.code = t('promotions.validation.codeRequired');
      if (!values.name.trim()) errors.name = t('promotions.validation.nameRequired');
      if (!values.branch_id) errors.branch_id = t('promotions.validation.branchRequired');

      if (values.discount_value === '') {
        errors.discount_value = t('promotions.validation.discountValueRequired');
      } else {
        const discountValue = Number(values.discount_value);
        const isValid =
          values.discount_type === PROMOTION_DISCOUNT_TYPE.PERCENTAGE
            ? discountValue >= 1 && discountValue <= 100
            : discountValue > 0;
        if (!isValid) errors.discount_value = t('promotions.validation.discountValueInvalid');
      }

      if (values.minimum_order_value !== '' && Number(values.minimum_order_value) < 0) {
        errors.minimum_order_value = t('promotions.validation.minOrderValueInvalid');
      }
      if (values.maximum_discount !== '' && Number(values.maximum_discount) < 0) {
        errors.maximum_discount = t('promotions.validation.maxDiscountInvalid');
      }
      if (values.usage_limit !== '' && Number(values.usage_limit) < 1) {
        errors.usage_limit = t('promotions.validation.usageLimitInvalid');
      }
      if (values.per_customer_limit !== '' && Number(values.per_customer_limit) < 1) {
        errors.per_customer_limit = t('promotions.validation.perCustomerLimitInvalid');
      }

      if (!values.start_at) errors.start_at = t('promotions.validation.startAtRequired');
      if (!values.end_at) errors.end_at = t('promotions.validation.endAtRequired');
      if (values.start_at && values.end_at && values.start_at >= values.end_at) {
        errors.end_at = t('promotions.validation.dateRangeInvalid');
      }
      return errors;
    },
    [t],
  );

  const handleCreate = useCallback(
    async (values: PromotionFormValues, { resetForm }: FormikHelpers<PromotionFormValues>) => {
      try {
        await createPromotionMutation.mutateAsync(toPromotionPayload(values));
        toast.success(t('promotions.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createPromotionMutation, dispatch, t],
  );

  const handleUpdate = useCallback(
    async (values: PromotionFormValues) => {
      if (!editingPromotion) return;
      try {
        await updatePromotionMutation.mutateAsync({ id: editingPromotion.id, ...toPromotionPayload(values) });
        toast.success(t('promotions.updateSuccess'));
        dispatch(closeEditModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [editingPromotion, updatePromotionMutation, dispatch, t],
  );

  const branchOptions = useMemo(() => {
    const options = cinemas.map((c) => ({ label: c.name, value: String(c.id) }));
    return isAdmin ? [...options, { label: t('promotions.allBranchesOption'), value: ALL_BRANCHES }] : options;
  }, [cinemas, isAdmin, t]);

  const movieOptions = useMemo(
    () => [{ label: t('promotions.anyOption'), value: '' }, ...movies.map((m) => ({ label: m.name, value: String(m.id) }))],
    [movies, t],
  );
  const comboOptions = useMemo(
    () => [{ label: t('promotions.anyOption'), value: '' }, ...combos.map((c) => ({ label: c.name, value: String(c.id) }))],
    [combos, t],
  );

  const describeScope = useCallback(
    (promotion: Promotion) => {
      const parts: string[] = [];
      parts.push(
        promotion.branch_ids.length === 0
          ? t('promotions.allBranchesOption')
          : promotion.branch_ids.map((id) => branchNameById.get(id) ?? `#${id}`).join(', '),
      );
      if (promotion.movie_ids.length > 0) {
        parts.push(promotion.movie_ids.map((id) => movieNameById.get(id) ?? `#${id}`).join(', '));
      }
      if (promotion.combo_ids.length > 0) {
        parts.push(promotion.combo_ids.map((id) => comboNameById.get(id) ?? `#${id}`).join(', '));
      }
      return parts.join(' · ');
    },
    [branchNameById, movieNameById, comboNameById, t],
  );

  return (
    <AdminLayout breadcrumb={t('promotions.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('promotions.addButton')}
      </Button>

      {showAddModal && (
        <AddPromotionModal
          onClose={() => dispatch(closeAddModal())}
          onSubmit={handleCreate}
          validate={validatePromotion}
          defaultBranchId={defaultBranchId}
          branchOptions={branchOptions}
          movieOptions={movieOptions}
          comboOptions={comboOptions}
          isPending={createPromotionMutation.isPending}
        />
      )}

      {editingPromotion && (
        <EditPromotionModal
          promotion={editingPromotion}
          onClose={() => dispatch(closeEditModal())}
          onSubmit={handleUpdate}
          validate={validatePromotion}
          branchOptions={branchOptions}
          movieOptions={movieOptions}
          comboOptions={comboOptions}
          isPending={updatePromotionMutation.isPending}
        />
      )}

      <div className="mt-6">
        <PromotionsTable
          promotions={promotions}
          describeScope={describeScope}
          onEdit={(id) => dispatch(openEditModal(id))}
          onToggleActive={toggleActive}
          onDelete={handleDelete}
        />
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default PromotionList;
