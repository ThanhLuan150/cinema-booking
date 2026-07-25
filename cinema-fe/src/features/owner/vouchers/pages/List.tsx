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
import { useOwnerVouchers } from '../../hooks/useOwnerVouchers';
import { useCreateVoucher, useDeleteVoucher, useUpdateVoucher } from '../../hooks/useVoucherMutations';
import { closeAddModal, openAddModal } from '../../store/ownerVouchersSlice';
import type { VoucherFormValues } from '../../types/owner.types';
import { DISCOUNT_TYPE } from '@/constants/discountType';

const emptyForm = (): VoucherFormValues => ({
  cinema_id: '',
  code: '',
  discount_type: DISCOUNT_TYPE.percent,
  discount_value: '',
  min_order_value: '',
});

function VoucherList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const { data: cinemas = [] } = useMyCinemas();
  const { data: vouchers = [] } = useOwnerVouchers();
  const { showAddModal } = useAppSelector((state) => state.ownerVouchers);
  const createVoucherMutation = useCreateVoucher();
  const updateVoucherMutation = useUpdateVoucher();
  const deleteVoucherMutation = useDeleteVoucher();

  const toggleActive = async (voucher: { id: number; active: boolean }) => {
    try {
      await updateVoucherMutation.mutateAsync({ id: voucher.id, active: !voucher.active });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog(t('vouchers.deleteConfirm')))) return;
    try {
      await deleteVoucherMutation.mutateAsync(id);
      toast.success(t('vouchers.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleSubmit = async (values: VoucherFormValues, { resetForm }: FormikHelpers<VoucherFormValues>) => {
    try {
      await createVoucherMutation.mutateAsync(values);
      toast.success(t('vouchers.createSuccess'));
      resetForm();
      dispatch(closeAddModal());
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AdminLayout breadcrumb={t('vouchers.breadcrumb')}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('vouchers.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('vouchers.addTitle')}>
          <Formik<VoucherFormValues> initialValues={emptyForm()} onSubmit={handleSubmit}>
            <Form>
              <Field
                as={Select}
                label={t('vouchers.cinemaLabel')}
                name="cinema_id"
                options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                placeholder={t('vouchers.cinemaPlaceholder')}
                required
              />
              <Field as={Input} label={t('vouchers.codeLabel')} name="code" className="mt-3" required />
              <Field
                as={Select}
                label={t('vouchers.discountTypeLabel')}
                name="discount_type"
                options={[
                  { label: t('vouchers.discountTypePercent'), value: DISCOUNT_TYPE.percent },
                  { label: t('vouchers.discountTypeFixed'), value: DISCOUNT_TYPE.fixed },
                ]}
                className="mt-3"
              />
              <Field
                as={Input}
                label={t('vouchers.discountValueLabel')}
                name="discount_value"
                type="number"
                className="mt-3"
                required
              />
              <Field as={Input} label={t('vouchers.minOrderValueLabel')} name="min_order_value" type="number" className="mt-3" />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={createVoucherMutation.isPending}>
                  {t('vouchers.submit')}
                </Button>
              </div>
            </Form>
          </Formik>
        </Modal>
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('vouchers.headers.id'),
            t('vouchers.headers.cinema'),
            t('vouchers.headers.code'),
            t('vouchers.headers.discount'),
            t('vouchers.headers.used'),
            t('vouchers.headers.status'),
            t('vouchers.headers.actions'),
          ]}
        >
          {vouchers.map((voucher) => (
            <tr key={voucher.id}>
              <td>{voucher.id}</td>
              <td>{cinemas.find((c) => c.id === voucher.cinema_id)?.name || voucher.cinema_id}</td>
              <td>{voucher.code}</td>
              <td>
                {voucher.discount_type === DISCOUNT_TYPE.percent ? `${voucher.discount_value}%` : `${voucher.discount_value.toLocaleString()}đ`}
              </td>
              <td>
                {voucher.used_count}
                {voucher.max_uses !== null ? `/${voucher.max_uses}` : ''}
              </td>
              <td>{voucher.active ? t('vouchers.statusActive') : t('vouchers.statusInactive')}</td>
              <td className="flex gap-3">
                <button type="button" className="text-accent" onClick={() => toggleActive(voucher)}>
                  {voucher.active ? t('vouchers.deactivate') : t('vouchers.activate')}
                </button>
                <button type="button" className="text-red-500" onClick={() => handleDelete(voucher.id)}>
                  {t('vouchers.delete')}
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </AdminLayout>
  );
}

export default VoucherList;
