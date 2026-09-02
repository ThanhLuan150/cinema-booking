import { useCallback, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
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

// branch_id: '' is only ever reached transiently for a non-admin before their first owned
// branch loads in; ALL_BRANCHES is the explicit "system-wide" choice, admin-only (mirrors
// PricingRuleFormValues.branch_id). movie_id/combo_id: '' = no restriction on that dimension.
// Showtime-level targeting has no picker in this UI yet — the backend still enforces it fully
// (see promotion.controller.js / promotionPricing.js) for promotions created via the API.
const ALL_BRANCHES = 'ALL';

function emptyForm(branchId: string): PromotionFormValues {
  return {
    code: '',
    name: '',
    description: '',
    discount_type: PROMOTION_DISCOUNT_TYPE.PERCENTAGE,
    discount_value: '',
    minimum_order_value: '',
    maximum_discount: '',
    start_at: '',
    end_at: '',
    usage_limit: '',
    per_customer_limit: '',
    branch_id: branchId,
    movie_id: '',
    combo_id: '',
  };
}

function promotionToFormValues(promotion: Promotion): PromotionFormValues {
  return {
    code: promotion.code,
    name: promotion.name,
    description: promotion.description,
    discount_type: promotion.discount_type,
    discount_value: String(promotion.discount_value),
    minimum_order_value: String(promotion.minimum_order_value),
    maximum_discount: promotion.maximum_discount === null ? '' : String(promotion.maximum_discount),
    start_at: promotion.start_at.slice(0, 10),
    end_at: promotion.end_at.slice(0, 10),
    usage_limit: promotion.usage_limit === null ? '' : String(promotion.usage_limit),
    per_customer_limit: promotion.per_customer_limit === null ? '' : String(promotion.per_customer_limit),
    branch_id: promotion.branch_ids.length === 0 ? ALL_BRANCHES : String(promotion.branch_ids[0]),
    movie_id: promotion.movie_ids.length > 0 ? String(promotion.movie_ids[0]) : '',
    combo_id: promotion.combo_ids.length > 0 ? String(promotion.combo_ids[0]) : '',
  };
}

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
  const discountTypeOptions = [
    { label: t('promotions.discountTypePercentage'), value: PROMOTION_DISCOUNT_TYPE.PERCENTAGE },
    { label: t('promotions.discountTypeFixed'), value: PROMOTION_DISCOUNT_TYPE.FIXED_AMOUNT },
  ];

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

  const renderFormFields = (formik: { submitCount: number; errors: Partial<Record<keyof PromotionFormValues, string>> }) => {
    const showErrors = formik.submitCount > 0;
    return (
      <>
        <Field as={Input} label={t('promotions.codeLabel')} name="code" error={showErrors ? formik.errors.code : undefined} />
        <Field
          as={Input}
          label={t('promotions.nameLabel')}
          name="name"
          className="mt-3"
          error={showErrors ? formik.errors.name : undefined}
        />
        <Field as={Textarea} label={t('promotions.descriptionLabel')} name="description" className="mt-3" rows={2} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field as={Select} label={t('promotions.discountTypeLabel')} name="discount_type" options={discountTypeOptions} />
          <Field
            as={Input}
            label={t('promotions.discountValueLabel')}
            name="discount_value"
            type="number"
            error={showErrors ? formik.errors.discount_value : undefined}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field as={Input} label={t('promotions.minOrderValueLabel')} name="minimum_order_value" type="number" />
          <Field as={Input} label={t('promotions.maxDiscountLabel')} name="maximum_discount" type="number" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field
            as={DateInput}
            label={t('promotions.startAtLabel')}
            id="start_at"
            name="start_at"
            error={showErrors ? formik.errors.start_at : undefined}
          />
          <Field
            as={DateInput}
            label={t('promotions.endAtLabel')}
            id="end_at"
            name="end_at"
            error={showErrors ? formik.errors.end_at : undefined}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field as={Input} label={t('promotions.usageLimitLabel')} name="usage_limit" type="number" />
          <Field as={Input} label={t('promotions.perCustomerLimitLabel')} name="per_customer_limit" type="number" />
        </div>
        <Field
          as={Select}
          label={t('promotions.branchLabel')}
          name="branch_id"
          className="mt-3"
          options={branchOptions}
          placeholder={t('promotions.branchPlaceholder')}
          error={showErrors ? formik.errors.branch_id : undefined}
        />
        <Field as={Select} label={t('promotions.movieLabel')} name="movie_id" className="mt-3" options={movieOptions} />
        <Field as={Select} label={t('promotions.comboLabel')} name="combo_id" className="mt-3" options={comboOptions} />
      </>
    );
  };

  return (
    <AdminLayout breadcrumb={t('promotions.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('promotions.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('promotions.addTitle')}>
          <Formik<PromotionFormValues>
            initialValues={emptyForm(defaultBranchId)}
            validate={validatePromotion}
            onSubmit={handleCreate}
          >
            {(formik) => (
              <Form>
                {renderFormFields(formik)}
                <div className="mt-6 flex justify-end">
                  <Button type="submit" variant="danger" loading={createPromotionMutation.isPending}>
                    {t('promotions.submit')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </Modal>
      )}

      {editingPromotion && (
        <Modal open onClose={() => dispatch(closeEditModal())} title={t('promotions.editTitle')}>
          <Formik<PromotionFormValues>
            initialValues={promotionToFormValues(editingPromotion)}
            validate={validatePromotion}
            onSubmit={handleUpdate}
          >
            {(formik) => (
              <Form>
                {renderFormFields(formik)}
                <div className="mt-6 flex justify-end">
                  <Button type="submit" variant="danger" loading={updatePromotionMutation.isPending}>
                    {t('promotions.submit')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </Modal>
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('promotions.headers.id'),
            t('promotions.headers.code'),
            t('promotions.headers.name'),
            t('promotions.headers.scope'),
            t('promotions.headers.discount'),
            t('promotions.headers.used'),
            t('promotions.headers.period'),
            t('promotions.headers.status'),
            t('promotions.headers.actions'),
          ]}
        >
          {promotions.map((promotion) => (
            <tr key={promotion.id}>
              <td>{promotion.id}</td>
              <td>{promotion.code}</td>
              <td>{promotion.name}</td>
              <td>{describeScope(promotion)}</td>
              <td>
                {promotion.discount_type === PROMOTION_DISCOUNT_TYPE.PERCENTAGE
                  ? `${promotion.discount_value}%`
                  : `${promotion.discount_value.toLocaleString()}đ`}
              </td>
              <td>
                {promotion.used_count}
                {promotion.usage_limit !== null ? `/${promotion.usage_limit}` : ''}
              </td>
              <td>
                {new Date(promotion.start_at).toLocaleDateString()} → {new Date(promotion.end_at).toLocaleDateString()}
              </td>
              <td>
                <Badge variant={promotion.status === 'ACTIVE' ? 'success' : 'default'}>
                  {promotion.status === 'ACTIVE' ? t('promotions.statusActive') : t('promotions.statusInactive')}
                </Badge>
              </td>
              <td className="flex gap-3">
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => dispatch(openEditModal(promotion.id))}
                >
                  {t('promotions.edit')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => toggleActive(promotion)}
                >
                  {promotion.status === 'ACTIVE' ? t('promotions.deactivate') : t('promotions.activate')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => handleDelete(promotion.id)}
                >
                  {t('promotions.delete')}
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default PromotionList;
