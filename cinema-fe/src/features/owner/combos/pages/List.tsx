import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerCombos } from '../../hooks/useOwnerCombos';
import { useCreateCombo, useDeleteCombo, useUpdateCombo } from '../../hooks/useComboMutations';
import { closeAddModal, openAddModal } from '../../store/ownerCombosSlice';
import type { ComboFormValues } from '../../types/owner.types';

const emptyForm = (): ComboFormValues => ({ cinema_id: '', name: '', description: '', price: '' });

function ComboList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const { data: cinemas = [] } = useMyCinemas();
  const { data: combos = [] } = useOwnerCombos();
  const { showAddModal } = useAppSelector((state) => state.ownerCombos);
  const createComboMutation = useCreateCombo();
  const updateComboMutation = useUpdateCombo();
  const deleteComboMutation = useDeleteCombo();

  const toggleActive = async (combo: { id: number; active: boolean }) => {
    try {
      await updateComboMutation.mutateAsync({ id: combo.id, active: !combo.active });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog(t('combos.deleteConfirm')))) return;
    try {
      await deleteComboMutation.mutateAsync(id);
      toast.success(t('combos.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleSubmit = async (values: ComboFormValues, { resetForm }: FormikHelpers<ComboFormValues>) => {
    try {
      await createComboMutation.mutateAsync(values);
      toast.success(t('combos.createSuccess'));
      resetForm();
      dispatch(closeAddModal());
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const validateCombo = (values: ComboFormValues) => {
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
  };

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
            t('combos.headers.price'),
            t('combos.headers.status'),
            t('combos.headers.actions'),
          ]}
        >
          {combos.map((combo) => (
            <tr key={combo.id}>
              <td>{combo.id}</td>
              <td>{cinemas.find((c) => c.id === combo.cinema_id)?.name || combo.cinema_id}</td>
              <td>{combo.name}</td>
              <td>{combo.price.toLocaleString()}đ</td>
              <td>{combo.active ? t('combos.statusActive') : t('combos.statusInactive')}</td>
              <td className="flex gap-3">
                <button type="button" className="text-accent" onClick={() => toggleActive(combo)}>
                  {combo.active ? t('combos.deactivate') : t('combos.activate')}
                </button>
                <button type="button" className="text-red-500" onClick={() => handleDelete(combo.id)}>
                  {t('combos.delete')}
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </AdminLayout>
  );
}

export default ComboList;
