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

  return (
    <AdminLayout breadcrumb={t('combos.breadcrumb')}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('combos.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('combos.addTitle')}>
          <Formik<ComboFormValues> initialValues={emptyForm()} onSubmit={handleSubmit}>
            <Form>
              <Field
                as={Select}
                label={t('combos.cinemaLabel')}
                name="cinema_id"
                options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                placeholder={t('combos.cinemaPlaceholder')}
                required
              />
              <Field as={Input} label={t('combos.nameLabel')} name="name" className="mt-3" required />
              <Field as={Input} label={t('combos.descriptionLabel')} name="description" className="mt-3" />
              <Field as={Input} label={t('combos.priceLabel')} name="price" type="number" className="mt-3" required />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={createComboMutation.isPending}>
                  {t('combos.submit')}
                </Button>
              </div>
            </Form>
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
