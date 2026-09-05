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
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { DISCOUNT_TYPE } from '@/constants/discountType';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerCombos } from '../../hooks/useOwnerCombos';
import { useOwnerVouchers } from '../../hooks/useOwnerVouchers';
import { useVoucherHistory } from '../hooks/useVoucherHistory';
import { useCreateVoucher, useDeleteVoucher, useUpdateVoucher } from '../../hooks/useVoucherMutations';
import { closeAddModal, openAddModal } from '../../store/ownerVouchersSlice';
import type { VoucherFormValues } from '../../types/owner.types';

const FREE_TYPES: string[] = [DISCOUNT_TYPE.FREE_TICKET, DISCOUNT_TYPE.FREE_COMBO];

const emptyForm = (): VoucherFormValues => ({
  cinema_id: '',
  code: '',
  discount_type: DISCOUNT_TYPE.PERCENTAGE,
  discount_value: '',
  free_quantity: '',
  combo_id: '',
  min_order_value: '',
});

function VoucherList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const [historyVoucherId, setHistoryVoucherId] = useState<number | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data: combosPage } = useOwnerCombos(1, 100);
  const combos = useMemo(() => combosPage?.data ?? [], [combosPage]);
  const { data, isLoading } = useOwnerVouchers(page, DEFAULT_PAGE_SIZE);
  const vouchers = data?.data ?? [];
  const { data: history, isLoading: historyLoading } = useVoucherHistory(historyVoucherId, historyPage, DEFAULT_PAGE_SIZE);
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

      const isFreeType = FREE_TYPES.includes(values.discount_type);
      if (isFreeType) {
        if (values.free_quantity === '' || Number(values.free_quantity) < 1) {
          errors.free_quantity = t('vouchers.validation.freeQuantityInvalid');
        }
      } else if (values.discount_value === '') {
        errors.discount_value = t('vouchers.validation.discountValueRequired');
      } else {
        const discountValue = Number(values.discount_value);
        const isValid =
          values.discount_type === DISCOUNT_TYPE.PERCENTAGE ? discountValue >= 1 && discountValue <= 100 : discountValue > 0;
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
  const comboNameById = useMemo(() => new Map(combos.map((c) => [c.id, c.name])), [combos]);

  const describeDiscount = useCallback(
    (voucher: (typeof vouchers)[number]) => {
      switch (voucher.discount_type) {
        case DISCOUNT_TYPE.PERCENTAGE:
          return `${voucher.discount_value}%`;
        case DISCOUNT_TYPE.FIXED_AMOUNT:
          return `${voucher.discount_value.toLocaleString()}đ`;
        case DISCOUNT_TYPE.FREE_TICKET:
          return t('vouchers.freeTicketSummary', { count: voucher.free_quantity ?? 1 });
        case DISCOUNT_TYPE.FREE_COMBO:
          return t('vouchers.freeComboSummary', {
            count: voucher.free_quantity ?? 1,
            combo: voucher.combo_id ? comboNameById.get(voucher.combo_id) ?? `#${voucher.combo_id}` : t('vouchers.anyCombo'),
          });
        default:
          return '-';
      }
    },
    [comboNameById, t],
  );

  return (
    <AdminLayout breadcrumb={t('vouchers.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('vouchers.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('vouchers.addTitle')}>
          <Formik<VoucherFormValues> initialValues={emptyForm()} validate={validateVoucher} onSubmit={handleSubmit}>
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              const isFreeType = FREE_TYPES.includes(formik.values.discount_type);
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
                      { label: t('vouchers.discountTypePercent'), value: DISCOUNT_TYPE.PERCENTAGE },
                      { label: t('vouchers.discountTypeFixed'), value: DISCOUNT_TYPE.FIXED_AMOUNT },
                      { label: t('vouchers.discountTypeFreeTicket'), value: DISCOUNT_TYPE.FREE_TICKET },
                      { label: t('vouchers.discountTypeFreeCombo'), value: DISCOUNT_TYPE.FREE_COMBO },
                    ]}
                    className="mt-3"
                  />
                  {!isFreeType && (
                    <Field
                      as={Input}
                      label={t('vouchers.discountValueLabel')}
                      name="discount_value"
                      type="number"
                      className="mt-3"
                      error={showErrors ? formik.errors.discount_value : undefined}
                    />
                  )}
                  {isFreeType && (
                    <Field
                      as={Input}
                      label={t('vouchers.freeQuantityLabel')}
                      name="free_quantity"
                      type="number"
                      min={1}
                      className="mt-3"
                      error={showErrors ? formik.errors.free_quantity : undefined}
                    />
                  )}
                  {formik.values.discount_type === DISCOUNT_TYPE.FREE_COMBO && (
                    <Field
                      as={Select}
                      label={t('vouchers.comboLabel')}
                      name="combo_id"
                      className="mt-3"
                      options={combos.map((c) => ({ label: c.name, value: c.id }))}
                      placeholder={t('vouchers.anyCombo')}
                    />
                  )}
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

      {historyVoucherId !== null && (
        <Modal open onClose={() => setHistoryVoucherId(null)} title={t('vouchers.historyTitle')}>
          <DataTable
            headers={[t('vouchers.headers.date'), t('vouchers.headers.account'), t('vouchers.headers.discountAmount')]}
          >
            {(history?.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>#{row.account_id}</td>
                <td>{row.discount_amount.toLocaleString()}đ</td>
              </tr>
            ))}
          </DataTable>
          {!historyLoading && (history?.data.length ?? 0) === 0 && (
            <EmptyState title={t('vouchers.historyEmpty')} icon="fa-solid fa-clock-rotate-left" />
          )}
          <Pagination page={historyPage} totalPages={history?.totalPages ?? 1} onPageChange={setHistoryPage} />
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
              <td>{describeDiscount(voucher)}</td>
              <td>
                {voucher.used_count}
                {voucher.max_uses !== null ? `/${voucher.max_uses}` : ''}
              </td>
              <td>
                <Badge variant={voucher.active ? 'success' : 'default'}>
                  {voucher.active ? t('vouchers.statusActive') : t('vouchers.statusInactive')}
                </Badge>
              </td>
              <td className="flex gap-3">
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => {
                    setHistoryPage(1);
                    setHistoryVoucherId(voucher.id);
                  }}
                >
                  {t('vouchers.viewHistory')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => toggleActive(voucher)}
                >
                  {voucher.active ? t('vouchers.deactivate') : t('vouchers.activate')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => handleDelete(voucher.id)}
                >
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
