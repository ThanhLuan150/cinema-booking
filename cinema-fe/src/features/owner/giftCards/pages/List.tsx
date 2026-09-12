import { useCallback, useMemo, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
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
import { GiftCardFormModal } from '../components/GiftCardFormModal';
import { GiftCardHistoryModal } from '../components/GiftCardHistoryModal';
import { GiftCardTable } from '../components/GiftCardTable';

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

  const cinemaNameById = useMemo(() => new Map<number | null, string>(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  return (
    <AdminLayout breadcrumb={t('giftCards.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('giftCards.addButton')}
      </Button>

      {showAddModal && (
        <GiftCardFormModal
          cinemas={cinemas}
          isSubmitting={createGiftCardMutation.isPending}
          onClose={() => dispatch(closeAddModal())}
          onSubmit={handleSubmit}
        />
      )}

      {historyCardId !== null && (
        <GiftCardHistoryModal
          history={history}
          isLoading={historyLoading}
          page={historyPage}
          onPageChange={setHistoryPage}
          onClose={() => setHistoryCardId(null)}
        />
      )}

      <GiftCardTable
        giftCards={giftCards}
        cinemaNameById={cinemaNameById}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        onViewHistory={(id) => {
          setHistoryPage(1);
          setHistoryCardId(id);
        }}
        onBlock={handleBlock}
      />
    </AdminLayout>
  );
}

export default GiftCardList;
