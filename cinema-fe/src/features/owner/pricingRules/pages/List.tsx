import { useCallback, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { TimeInput } from '@/components/ui/TimeInput';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
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
import type { PricingRulePayload } from '../../api/owner.api';
import type { PricingRuleFormValues } from '../../types/owner.types';

const ALL_BRANCHES = 'ALL';

function emptyRuleForm(branchId: string): PricingRuleFormValues {
  return {
    name: '',
    price: '',
    priority: '0',
    branch_id: branchId,
    room_type: '',
    seat_type: '',
    category_id: '',
    day_type: '',
    time_start: '',
    time_end: '',
    membership_level: '',
    effective_from: '',
    effective_to: '',
  };
}

function ruleToFormValues(rule: PricingRule): PricingRuleFormValues {
  return {
    name: rule.name,
    price: String(rule.price),
    priority: String(rule.priority),
    branch_id: rule.branch_id === null ? ALL_BRANCHES : String(rule.branch_id),
    room_type: rule.room_type ?? '',
    seat_type: rule.seat_type === null ? '' : String(rule.seat_type),
    category_id: rule.category_id === null ? '' : String(rule.category_id),
    day_type: rule.day_type ?? '',
    time_start: rule.time_start ?? '',
    time_end: rule.time_end ?? '',
    membership_level: rule.membership_level ?? '',
    effective_from: rule.effective_from ?? '',
    effective_to: rule.effective_to ?? '',
  };
}

function toRulePayload(values: PricingRuleFormValues): PricingRulePayload {
  return {
    name: values.name.trim(),
    price: Number(values.price),
    priority: values.priority === '' ? 0 : Number(values.priority),
    branch_id: values.branch_id === ALL_BRANCHES ? null : Number(values.branch_id),
    room_type: values.room_type || null,
    seat_type: values.seat_type === '' ? null : Number(values.seat_type),
    category_id: values.category_id === '' ? null : Number(values.category_id),
    day_type: values.day_type || null,
    time_start: values.time_start || null,
    time_end: values.time_end || null,
    membership_level: values.membership_level || null,
    effective_from: values.effective_from || null,
    effective_to: values.effective_to || null,
  };
}

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

  const { data } = useOwnerPricingRules(undefined, page, DEFAULT_PAGE_SIZE);
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

  const describeMatch = useCallback(
    (rule: PricingRule) => {
      const parts: string[] = [];
      if (rule.room_type) parts.push(rule.room_type);
      if (rule.seat_type !== null) parts.push(t(`pricingRules.seatTypeLabels.${SEAT_TYPE_KEY[rule.seat_type]}`));
      if (rule.category_id !== null) parts.push(categoryNameById.get(rule.category_id) ?? `#${rule.category_id}`);
      if (rule.day_type) parts.push(t(`pricingRules.dayTypeLabels.${rule.day_type}`));
      if (rule.time_start && rule.time_end) parts.push(`${rule.time_start}-${rule.time_end}`);
      if (rule.membership_level) parts.push(t(`pricingRules.membershipLabels.${rule.membership_level}`));
      return parts.length > 0 ? parts.join(' · ') : t('pricingRules.matchAny');
    },
    [categoryNameById, t],
  );

  const describeEffective = useCallback((rule: PricingRule) => {
    if (!rule.effective_from && !rule.effective_to) return '—';
    return `${rule.effective_from ?? '…'} → ${rule.effective_to ?? '…'}`;
  }, []);

  const renderRuleFormFields = (formik: { submitCount: number; errors: Partial<Record<keyof PricingRuleFormValues, string>> }) => {
    const showErrors = formik.submitCount > 0;
    return (
      <>
        <Field as={Input} label={t('pricingRules.nameLabel')} name="name" error={showErrors ? formik.errors.name : undefined} />
        <Field
          as={Input}
          label={t('pricingRules.priceLabel')}
          name="price"
          type="number"
          className="mt-3"
          error={showErrors ? formik.errors.price : undefined}
        />
        <Field
          as={Input}
          label={t('pricingRules.priorityLabel')}
          name="priority"
          type="number"
          className="mt-3"
        />
        <p className="mt-1 text-xs text-txt/50">{t('pricingRules.priorityHint')}</p>
        <Field
          as={Select}
          label={t('pricingRules.branchLabel')}
          name="branch_id"
          className="mt-3"
          options={branchOptions}
          placeholder={t('pricingRules.branchPlaceholder')}
          error={showErrors ? formik.errors.branch_id : undefined}
        />
        <Field as={Select} label={t('pricingRules.roomTypeLabel')} name="room_type" className="mt-3" options={roomTypeOptions} />
        <Field as={Select} label={t('pricingRules.seatTypeLabel')} name="seat_type" className="mt-3" options={seatTypeOptions} />
        <Field as={Select} label={t('pricingRules.categoryLabel')} name="category_id" className="mt-3" options={categoryOptions} />
        <Field as={Select} label={t('pricingRules.dayTypeLabel')} name="day_type" className="mt-3" options={dayTypeOptions} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field
            as={TimeInput}
            label={t('pricingRules.timeStartLabel')}
            id="time_start"
            name="time_start"
            error={showErrors ? formik.errors.time_start : undefined}
          />
          <Field
            as={TimeInput}
            label={t('pricingRules.timeEndLabel')}
            id="time_end"
            name="time_end"
            error={showErrors ? formik.errors.time_end : undefined}
          />
        </div>
        <Field
          as={Select}
          label={t('pricingRules.membershipLabel')}
          name="membership_level"
          className="mt-3"
          options={membershipOptions}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field
            as={DateInput}
            label={t('pricingRules.effectiveFromLabel')}
            id="effective_from"
            name="effective_from"
          />
          <Field
            as={DateInput}
            label={t('pricingRules.effectiveToLabel')}
            id="effective_to"
            name="effective_to"
            error={showErrors ? formik.errors.effective_to : undefined}
          />
        </div>
      </>
    );
  };

  return (
    <AdminLayout breadcrumb={t('pricingRules.breadcrumb')}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('pricingRules.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('pricingRules.addTitle')}>
          <Formik<PricingRuleFormValues>
            initialValues={emptyRuleForm(defaultBranchId)}
            validate={validateRule}
            onSubmit={handleCreate}
          >
            {(formik) => (
              <Form>
                {renderRuleFormFields(formik)}
                <div className="mt-6 flex justify-end">
                  <Button type="submit" variant="danger" loading={createRuleMutation.isPending}>
                    {t('pricingRules.submit')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </Modal>
      )}

      {editingRule && (
        <Modal open onClose={() => dispatch(closeEditModal())} title={t('pricingRules.editTitle')}>
          <Formik<PricingRuleFormValues>
            initialValues={ruleToFormValues(editingRule)}
            validate={validateRule}
            onSubmit={handleUpdate}
          >
            {(formik) => (
              <Form>
                {renderRuleFormFields(formik)}
                <div className="mt-6 flex justify-end">
                  <Button type="submit" variant="danger" loading={updateRuleMutation.isPending}>
                    {t('pricingRules.submit')}
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
            t('pricingRules.headers.id'),
            t('pricingRules.headers.name'),
            t('pricingRules.headers.branch'),
            t('pricingRules.headers.match'),
            t('pricingRules.headers.price'),
            t('pricingRules.headers.priority'),
            t('pricingRules.headers.effective'),
            t('pricingRules.headers.status'),
            t('pricingRules.headers.actions'),
          ]}
        >
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.id}</td>
              <td>{rule.name}</td>
              <td>{rule.branch_id === null ? t('pricingRules.allBranchesOption') : branchNameById.get(rule.branch_id) || rule.branch_id}</td>
              <td>{describeMatch(rule)}</td>
              <td>{rule.price.toLocaleString()}đ</td>
              <td>{rule.priority}</td>
              <td>{describeEffective(rule)}</td>
              <td>
                <Badge variant={rule.active ? 'success' : 'default'}>
                  {rule.active ? t('pricingRules.statusActive') : t('pricingRules.statusInactive')}
                </Badge>
              </td>
              <td className="flex gap-3">
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => dispatch(openEditModal(rule.id))}
                >
                  {t('pricingRules.edit')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => toggleActive(rule)}
                >
                  {rule.active ? t('pricingRules.deactivate') : t('pricingRules.activate')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => handleDelete(rule.id)}
                >
                  {t('pricingRules.delete')}
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

export default PricingRuleList;
