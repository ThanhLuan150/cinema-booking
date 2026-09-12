import { useCallback, useMemo, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCategories } from '@/features/movies/hooks/useCategories';
import { ROLES } from '@/constants/roles';
import { ROOM_TYPES } from '@/constants/roomType';
import { SEAT_TYPE_KEY, SEAT_TYPES } from '@/constants/seatType';
import { DAY_TYPES } from '@/constants/dayType';
import { MEMBERSHIP_LEVELS } from '@/constants/membershipLevel';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { PricingRule } from '@/types/entities';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerPricingRules } from '../../hooks/useOwnerPricingRules';
import { useCreatePricingRule, useDeletePricingRule, useUpdatePricingRule } from '../../hooks/usePricingRuleMutations';
import { closeAddModal, openAddModal, closeEditModal, openEditModal } from '../../store/ownerPricingRulesSlice';
import type { PricingRuleFormValues } from '../../types/owner.types';
import { ALL_BRANCHES, emptyRuleForm, ruleToFormValues, toRulePayload } from '../constants';
import { PricingRuleFormModal } from '../components/PricingRuleFormModal';
import { PricingRulesTable } from '../components/PricingRulesTable';

function PricingRuleList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const isAdmin = useAuthRole() === ROLES.admin;

  const [page, setPage] = useState(1);

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data: categories = [] } = useCategories();
  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  const defaultBranchId = isAdmin ? '' : cinemas.length > 0 ? String(cinemas[0].id) : '';

  const { data, isLoading } = useOwnerPricingRules(undefined, page, DEFAULT_PAGE_SIZE);
  const rules = useMemo(() => data?.data ?? [], [data]);
  const { showAddModal, editingRuleId } = useAppSelector((state) => state.ownerPricingRules);
  const editingRule = useMemo(() => rules.find((r) => r.id === editingRuleId) ?? null, [rules, editingRuleId]);

  const createRuleMutation = useCreatePricingRule();
  const updateRuleMutation = useUpdatePricingRule();
  const deleteRuleMutation = useDeletePricingRule();

  const toggleActive = useCallback(
    async (rule: PricingRule) => {
      try {
        await updateRuleMutation.mutateAsync({ id: rule.id, active: !rule.active });
      } catch (error) {
        console.error(error);
      }
    },
    [updateRuleMutation],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('pricingRules.deleteConfirm')))) return;
      try {
        await deleteRuleMutation.mutateAsync(id);
        toast.success(t('pricingRules.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteRuleMutation, t],
  );

  const validateRule = useCallback(
    (values: PricingRuleFormValues) => {
      const errors: Partial<Record<keyof PricingRuleFormValues, string>> = {};
      if (!values.name.trim()) errors.name = t('pricingRules.validation.nameRequired');
      if (values.price === '') {
        errors.price = t('pricingRules.validation.priceRequired');
      } else if (Number(values.price) < 0) {
        errors.price = t('pricingRules.validation.priceInvalid');
      }
      if (!values.branch_id) errors.branch_id = t('pricingRules.validation.branchRequired');

      const hasStart = values.time_start !== '';
      const hasEnd = values.time_end !== '';
      if (hasStart !== hasEnd) {
        errors.time_start = t('pricingRules.validation.timePairRequired');
        errors.time_end = t('pricingRules.validation.timePairRequired');
      } else if (hasStart && values.time_start > values.time_end) {
        errors.time_end = t('pricingRules.validation.timeRangeInvalid');
      }

      if (values.effective_from && values.effective_to && values.effective_from > values.effective_to) {
        errors.effective_to = t('pricingRules.validation.effectiveRangeInvalid');
      }
      return errors;
    },
    [t],
  );

  const handleCreate = useCallback(
    async (values: PricingRuleFormValues, { resetForm }: FormikHelpers<PricingRuleFormValues>) => {
      try {
        await createRuleMutation.mutateAsync(toRulePayload(values));
        toast.success(t('pricingRules.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createRuleMutation, dispatch, t],
  );

  const handleUpdate = useCallback(
    async (values: PricingRuleFormValues) => {
      if (!editingRule) return;
      try {
        await updateRuleMutation.mutateAsync({ id: editingRule.id, ...toRulePayload(values) });
        toast.success(t('pricingRules.updateSuccess'));
        dispatch(closeEditModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [editingRule, updateRuleMutation, dispatch, t],
  );

  const branchOptions = useMemo(() => {
    const options = cinemas.map((c) => ({ label: c.name, value: String(c.id) }));
    return isAdmin ? [...options, { label: t('pricingRules.allBranchesOption'), value: ALL_BRANCHES }] : options;
  }, [cinemas, isAdmin, t]);

  const roomTypeOptions = [
    { label: t('pricingRules.anyOption'), value: '' },
    ...ROOM_TYPES.map((type) => ({ label: type, value: type })),
  ];
  const seatTypeOptions = [
    { label: t('pricingRules.anyOption'), value: '' },
    ...Object.values(SEAT_TYPES).map((value) => ({
      label: t(`pricingRules.seatTypeLabels.${SEAT_TYPE_KEY[value]}`),
      value: String(value),
    })),
  ];
  const categoryOptions = [
    { label: t('pricingRules.anyOption'), value: '' },
    ...categories.map((c) => ({ label: c.name, value: String(c.id) })),
  ];
  const dayTypeOptions = [
    { label: t('pricingRules.anyOption'), value: '' },
    ...DAY_TYPES.map((day) => ({ label: t(`pricingRules.dayTypeLabels.${day}`), value: day })),
  ];
  const membershipOptions = [
    { label: t('pricingRules.anyOption'), value: '' },
    ...MEMBERSHIP_LEVELS.map((level) => ({ label: t(`pricingRules.membershipLabels.${level}`), value: level })),
  ];

  return (
    <AdminLayout breadcrumb={t('pricingRules.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('pricingRules.addButton')}
      </Button>

      {showAddModal && (
        <PricingRuleFormModal
          mode="create"
          initialValues={emptyRuleForm(defaultBranchId)}
          branchOptions={branchOptions}
          roomTypeOptions={roomTypeOptions}
          seatTypeOptions={seatTypeOptions}
          categoryOptions={categoryOptions}
          dayTypeOptions={dayTypeOptions}
          membershipOptions={membershipOptions}
          saving={createRuleMutation.isPending}
          onClose={() => dispatch(closeAddModal())}
          onSubmit={handleCreate}
          validate={validateRule}
        />
      )}

      {editingRule && (
        <PricingRuleFormModal
          mode="edit"
          initialValues={ruleToFormValues(editingRule)}
          branchOptions={branchOptions}
          roomTypeOptions={roomTypeOptions}
          seatTypeOptions={seatTypeOptions}
          categoryOptions={categoryOptions}
          dayTypeOptions={dayTypeOptions}
          membershipOptions={membershipOptions}
          saving={updateRuleMutation.isPending}
          onClose={() => dispatch(closeEditModal())}
          onSubmit={handleUpdate}
          validate={validateRule}
        />
      )}

      <PricingRulesTable
        rules={rules}
        branchNameById={branchNameById}
        categoryNameById={categoryNameById}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        onEdit={(id) => dispatch(openEditModal(id))}
        onToggleActive={toggleActive}
        onDelete={handleDelete}
      />
    </AdminLayout>
  );
}

export default PricingRuleList;
