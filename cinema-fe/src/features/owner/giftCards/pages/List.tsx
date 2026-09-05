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
import { DateInput } from '@/components/ui/DateInput';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerGiftCards } from '../../hooks/useOwnerGiftCards';
import { useGiftCardHistory } from '../hooks/useGiftCardHistory';
import { useCreateGiftCard, useBlockGiftCard } from '../../hooks/useGiftCardMutations';
import { closeAddModal, openAddModal } from '../../store/ownerGiftCardsSlice';
import type { GiftCardFormValues } from '../../types/owner.types';

const emptyForm = (): GiftCardFormValues => ({
  cinema_id: '',
  code: '',
  initial_balance: '',
  currency: 'VND',
  expires_at: '',
});

function GiftCardList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const [historyCardId, setHistoryCardId] = useState<number | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data, isLoading } = useOwnerGiftCards(page, DEFAULT_PAGE_SIZE);
  const giftCards = data?.data ?? [];
  const { data: history, isLoading: historyLoading } = useGiftCardHistory(historyCardId, historyPage, DEFAULT_PAGE_SIZE);
  const { showAddModal } = useAppSelector((state) => state.ownerGiftCards);
  const createGiftCardMutation = useCreateGiftCard();
  const blockGiftCardMutation = useBlockGiftCard();

  const handleBlock = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('giftCards.blockConfirm')))) return;
      try {
        await blockGiftCardMutation.mutateAsync(id);
        toast.success(t('giftCards.blockSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [blockGiftCardMutation, t],
  );

  const handleSubmit = useCallback(
    async (values: GiftCardFormValues, { resetForm }: FormikHelpers<GiftCardFormValues>) => {
      try {
        await createGiftCardMutation.mutateAsync(values);
        toast.success(t('giftCards.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createGiftCardMutation, dispatch, t],
  );

  const validate = useCallback(
    (values: GiftCardFormValues) => {
      const errors: Partial<Record<keyof GiftCardFormValues, string>> = {};
      if (!values.cinema_id) errors.cinema_id = t('giftCards.validation.cinemaRequired');
      if (!values.code) errors.code = t('giftCards.validation.codeRequired');
      if (values.initial_balance === '' || Number(values.initial_balance) <= 0) {
        errors.initial_balance = t('giftCards.validation.initialBalanceInvalid');
      }
      return errors;
    },
    [t],
  );

  const cinemaNameById = useMemo(() => new Map<number | null, string>(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  const statusVariant = (status: string) => {
    if (status === 'ACTIVE') return 'success';
    if (status === 'BLOCKED' || status === 'EXPIRED') return 'warning';
    return 'default';
  };

  return (
    <AdminLayout breadcrumb={t('giftCards.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('giftCards.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('giftCards.addTitle')}>
          <Formik<GiftCardFormValues> initialValues={emptyForm()} validate={validate} onSubmit={handleSubmit}>
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              return (
                <Form>
                  <Field
                    as={Select}
                    label={t('giftCards.cinemaLabel')}
                    name="cinema_id"
                    options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                    placeholder={t('giftCards.cinemaPlaceholder')}
                    error={showErrors ? formik.errors.cinema_id : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('giftCards.codeLabel')}
                    name="code"
                    className="mt-3"
                    error={showErrors ? formik.errors.code : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('giftCards.initialBalanceLabel')}
                    name="initial_balance"
                    type="number"
                    className="mt-3"
                    error={showErrors ? formik.errors.initial_balance : undefined}
                  />
                  <Field
                    as={DateInput}
                    label={t('giftCards.expiresAtLabel')}
                    id="expires_at"
                    name="expires_at"
                    className="mt-3"
                  />
                  <div className="mt-6 flex justify-end">
                    <Button type="submit" variant="danger" loading={createGiftCardMutation.isPending}>
                      {t('giftCards.submit')}
                    </Button>
                  </div>
                </Form>
              );
            }}
          </Formik>
        </Modal>
      )}

      {historyCardId !== null && (
        <Modal open onClose={() => setHistoryCardId(null)} title={t('giftCards.historyTitle')}>
          <DataTable
            headers={[
              t('giftCards.headers.date'),
              t('giftCards.headers.type'),
              t('giftCards.headers.amount'),
              t('giftCards.headers.balanceAfter'),
            ]}
          >
            {(history?.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{t(`giftCards.historyType.${row.type}`)}</td>
                <td>{row.amount.toLocaleString()}đ</td>
                <td>{row.balance_after.toLocaleString()}đ</td>
              </tr>
            ))}
          </DataTable>
          {!historyLoading && (history?.data.length ?? 0) === 0 && (
            <EmptyState title={t('giftCards.historyEmpty')} icon="fa-solid fa-clock-rotate-left" />
          )}
          <Pagination page={historyPage} totalPages={history?.totalPages ?? 1} onPageChange={setHistoryPage} />
        </Modal>
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('giftCards.headers.id'),
            t('giftCards.headers.cinema'),
            t('giftCards.headers.code'),
            t('giftCards.headers.balance'),
            t('giftCards.headers.owner'),
            t('giftCards.headers.status'),
            t('giftCards.headers.actions'),
          ]}
        >
          {giftCards.map((card) => (
            <tr key={card.id}>
              <td>{card.id}</td>
              <td>{card.cinema_id ? cinemaNameById.get(card.cinema_id) || card.cinema_id : t('giftCards.systemWide')}</td>
              <td>{card.code}</td>
              <td>
                {card.remaining_balance.toLocaleString()}đ / {card.initial_balance.toLocaleString()}đ
              </td>
              <td>{card.owner_account_id ? `#${card.owner_account_id}` : t('giftCards.unclaimed')}</td>
              <td>
                <Badge variant={statusVariant(card.status)}>{t(`giftCards.status.${card.status}`)}</Badge>
              </td>
              <td className="flex gap-3">
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => {
                    setHistoryPage(1);
                    setHistoryCardId(card.id);
                  }}
                >
                  {t('giftCards.viewHistory')}
                </button>
                {card.status !== 'BLOCKED' && (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                    onClick={() => handleBlock(card.id)}
                  >
                    {t('giftCards.block')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default GiftCardList;
