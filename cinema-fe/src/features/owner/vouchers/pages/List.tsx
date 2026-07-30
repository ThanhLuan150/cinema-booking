import { useCallback, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
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
  const [page, setPage] = useState(1);
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data } = useOwnerVouchers(page, DEFAULT_PAGE_SIZE);
  const vouchers = data?.data ?? [];
  const { showAddModal } = useAppSelector((state) => state.ownerVouchers);
  const createVoucherMutation = useCreateVoucher();
  const updateVoucherMutation = useUpdateVoucher();
  const deleteVoucherMutation = useDeleteVoucher();

  const toggleActive = useCallback(
    async (voucher: { id: number; active: boolean }) => {
      try {
        await updateVoucherMutation.mutateAsync({ id: voucher.id, active: !voucher.active });
      } catch (error) {
        console.error(error);
      }
    },
    [updateVoucherMutation],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('vouchers.deleteConfirm')))) return;
      try {
        await deleteVoucherMutation.mutateAsync(id);
        toast.success(t('vouchers.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteVoucherMutation, t],
  );

  const handleSubmit = useCallback(
    async (values: VoucherFormValues, { resetForm }: FormikHelpers<VoucherFormValues>) => {
      try {
        await createVoucherMutation.mutateAsync(values);
        toast.success(t('vouchers.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createVoucherMutation, dispatch, t],
  );

  const validateVoucher = useCallback(
    (values: VoucherFormValues) => {
      const errors: Partial<Record<keyof VoucherFormValues, string>> = {};
      if (!values.cinema_id) errors.cinema_id = t('vouchers.validation.cinemaRequired');
      if (!values.code) errors.code = t('vouchers.validation.codeRequired');
      if (values.discount_value === '') {
        errors.discount_value = t('vouchers.validation.discountValueRequired');
      } else {
        const discountValue = Number(values.discount_value);
        const isValid =
          values.discount_type === DISCOUNT_TYPE.percent ? discountValue >= 1 && discountValue <= 100 : discountValue > 0;
        if (!isValid) errors.discount_value = t('vouchers.validation.discountValueInvalid');
      }
      if (values.min_order_value === '') {
        errors.min_order_value = t('vouchers.validation.minOrderValueRequired');
      } else if (Number(values.min_order_value) < 0) {
        errors.min_order_value = t('vouchers.validation.minOrderValueInvalid');
      }
      return errors;
    },
    [t],
  );

  const cinemaNameById = useMemo(() => new Map<number | null, string>(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  return (
    <AdminLayout breadcrumb={t('vouchers.breadcrumb')}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('vouchers.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('vouchers.addTitle')}>
          <Formik<VoucherFormValues> initialValues={emptyForm()} validate={validateVoucher} onSubmit={handleSubmit}>
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              return (
                <Form>
                  <Field
                    as={Select}
                    label={t('vouchers.cinemaLabel')}
                    name="cinema_id"
                    options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                    placeholder={t('vouchers.cinemaPlaceholder')}
                    error={showErrors ? formik.errors.cinema_id : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('vouchers.codeLabel')}
                    name="code"
                    className="mt-3"
                    error={showErrors ? formik.errors.code : undefined}
                  />
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
                    error={showErrors ? formik.errors.discount_value : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('vouchers.minOrderValueLabel')}
                    name="min_order_value"
                    type="number"
                    className="mt-3"
                    error={showErrors ? formik.errors.min_order_value : undefined}
                  />
                  <div className="mt-6 flex justify-end">
                    <Button type="submit" variant="danger" loading={createVoucherMutation.isPending}>
                      {t('vouchers.submit')}
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
              <td>{cinemaNameById.get(voucher.cinema_id) || voucher.cinema_id}</td>
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
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default VoucherList;
