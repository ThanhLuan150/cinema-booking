import { useCallback, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerCombos } from '../../hooks/useOwnerCombos';
import { useComboComponents } from '../../hooks/useComboComponents';
import { useCreateCombo, useDeleteCombo, useUpdateCombo } from '../../hooks/useComboMutations';
import { closeAddModal, openAddModal } from '../../store/ownerCombosSlice';
import type { ComboFormValues } from '../../types/owner.types';

const COMBO_TYPE_OPTIONS = ['FOOD', 'BEVERAGE', 'COMBO'] as const;
const COMBO_TYPE_LABEL_KEY: Record<(typeof COMBO_TYPE_OPTIONS)[number], string> = {
  FOOD: 'combos.typeFood',
  BEVERAGE: 'combos.typeBeverage',
  COMBO: 'combos.typeCombo',
};

const emptyForm = (): ComboFormValues => ({
  cinema_id: '',
  name: '',
  description: '',
  price: '',
  type: 'COMBO',
  items: {},
});

interface ComboItemsFieldProps {
  cinemaId: string;
  type: ComboFormValues['type'];
  items: Record<number, number>;
  onChange: (items: Record<number, number>) => void;
}

// Only relevant when type === 'COMBO': lets the owner pick which FOOD/BEVERAGE items (and how
// many of each) this combo bundles together, from that branch's own catalog.
function ComboItemsField({ cinemaId, type, items, onChange }: ComboItemsFieldProps) {
  const { t } = useTranslation('owner');
  const { data } = useComboComponents(cinemaId || undefined);
  const components = (data?.data ?? []).filter((combo) => combo.type !== 'COMBO');

  if (type !== 'COMBO') return null;
  if (!cinemaId) {
    return <p className="mt-3 text-sm text-txt/60">{t('combos.itemsSelectCinemaFirst')}</p>;
  }
  if (components.length === 0) {
    return <p className="mt-3 text-sm text-txt/60">{t('combos.itemsNone')}</p>;
  }

  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-txt/90">{t('combos.itemsLabel')}</p>
      <div className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto">
        {components.map((component) => (
          <div
            key={component.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
          >
            <span className="text-sm text-txt">
              {component.name}{' '}
              <span className="text-txt/50">
                ({component.type === 'FOOD' ? t('combos.typeFood') : t('combos.typeBeverage')})
              </span>
            </span>
            <input
              type="number"
              min={0}
              value={items[component.id] ?? 0}
              onChange={(e) => onChange({ ...items, [component.id]: Math.max(0, Number(e.target.value)) })}
              className="w-20 rounded-lg border border-border-strong bg-surface-soft px-2 py-1.5 text-right text-txt"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ComboList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data } = useOwnerCombos(page, DEFAULT_PAGE_SIZE);
  const combos = data?.data ?? [];
  const { showAddModal } = useAppSelector((state) => state.ownerCombos);
  const createComboMutation = useCreateCombo();
  const updateComboMutation = useUpdateCombo();
  const deleteComboMutation = useDeleteCombo();

  const toggleActive = useCallback(
    async (combo: { id: number; active: boolean }) => {
      try {
        await updateComboMutation.mutateAsync({ id: combo.id, active: !combo.active });
      } catch (error) {
        console.error(error);
      }
    },
    [updateComboMutation],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('combos.deleteConfirm')))) return;
      try {
        await deleteComboMutation.mutateAsync(id);
        toast.success(t('combos.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteComboMutation, t],
  );

  const handleSubmit = useCallback(
    async (values: ComboFormValues, { resetForm }: FormikHelpers<ComboFormValues>) => {
      try {
        await createComboMutation.mutateAsync(values);
        toast.success(t('combos.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createComboMutation, dispatch, t],
  );

  const validateCombo = useCallback(
    (values: ComboFormValues) => {
      const errors: Partial<Record<keyof ComboFormValues, string>> = {};
      if (!values.cinema_id) errors.cinema_id = t('combos.validation.cinemaRequired');
      if (!values.name) errors.name = t('combos.validation.nameRequired');
      if (!values.description.trim()) errors.description = t('combos.validation.descriptionRequired');
      if (values.price === '') {
        errors.price = t('combos.validation.priceRequired');
      } else if (Number(values.price) <= 0) {
        errors.price = t('combos.validation.priceInvalid');
      }
      return errors;
    },
    [t],
  );

  const cinemaNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  return (
    <AdminLayout breadcrumb={t('combos.breadcrumb')}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('combos.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('combos.addTitle')}>
          <Formik<ComboFormValues> initialValues={emptyForm()} validate={validateCombo} onSubmit={handleSubmit}>
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              return (
                <Form>
                  <Field
                    as={Select}
                    label={t('combos.cinemaLabel')}
                    name="cinema_id"
                    options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                    placeholder={t('combos.cinemaPlaceholder')}
                    error={showErrors ? formik.errors.cinema_id : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('combos.nameLabel')}
                    name="name"
                    className="mt-3"
                    error={showErrors ? formik.errors.name : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('combos.descriptionLabel')}
                    name="description"
                    className="mt-3"
                    error={showErrors ? formik.errors.description : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('combos.priceLabel')}
                    name="price"
                    type="number"
                    className="mt-3"
                    error={showErrors ? formik.errors.price : undefined}
                  />
                  <Field
                    as={Select}
                    label={t('combos.typeLabel')}
                    name="type"
                    className="mt-3"
                    options={COMBO_TYPE_OPTIONS.map((value) => ({
                      label: t(COMBO_TYPE_LABEL_KEY[value]),
                      value,
                    }))}
                  />
                  <ComboItemsField
                    cinemaId={formik.values.cinema_id}
                    type={formik.values.type}
                    items={formik.values.items}
                    onChange={(items) => formik.setFieldValue('items', items)}
                  />
                  <div className="mt-6 flex justify-end">
                    <Button type="submit" variant="danger" loading={createComboMutation.isPending}>
                      {t('combos.submit')}
                    </Button>
                  </div>
                </Form>
              );
            }}
          </Formik>
        </Modal>
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('combos.headers.id'),
            t('combos.headers.cinema'),
            t('combos.headers.name'),
            t('combos.headers.type'),
            t('combos.headers.price'),
            t('combos.headers.status'),
            t('combos.headers.actions'),
          ]}
        >
          {combos.map((combo) => (
            <tr key={combo.id}>
              <td>{combo.id}</td>
              <td>{cinemaNameById.get(combo.cinema_id) || combo.cinema_id}</td>
              <td>{combo.name}</td>
              <td>{t(COMBO_TYPE_LABEL_KEY[combo.type] ?? COMBO_TYPE_LABEL_KEY.COMBO)}</td>
              <td>{combo.price.toLocaleString()}đ</td>
              <td>
                <Badge variant={combo.active ? 'success' : 'default'}>
                  {combo.active ? t('combos.statusActive') : t('combos.statusInactive')}
                </Badge>
              </td>
              <td className="flex gap-3">
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => toggleActive(combo)}
                >
                  {combo.active ? t('combos.deactivate') : t('combos.activate')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => handleDelete(combo.id)}
                >
                  {t('combos.delete')}
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

export default ComboList;
