import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { RedeemGiftCardForm } from '../components/RedeemGiftCardForm';
import { GiftCardList } from '../components/GiftCardList';
import { GiftCardHistoryModal } from '../components/GiftCardHistoryModal';

function MyGiftCardsPage() {
  const { t } = useTranslation('giftCards');
  const [historyCardId, setHistoryCardId] = useState<number | null>(null);

  return (
    <AccountLayout title={t('pageTitle')}>
      <RedeemGiftCardForm />
      <GiftCardList onViewHistory={setHistoryCardId} />
      {historyCardId !== null && (
        <GiftCardHistoryModal cardId={historyCardId} onClose={() => setHistoryCardId(null)} />
      )}
    </AccountLayout>
  );
}

export default MyGiftCardsPage;
