import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { useMyMembership } from '../hooks/useMyMembership';
import { MembershipSummaryCard } from '../components/MembershipSummaryCard';
import { RedeemPointsModal } from '../components/RedeemPointsModal';
import { PointsHistorySection } from '../components/PointsHistorySection';

function MyMembershipPage() {
  const { t } = useTranslation('membership');
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useMyMembership();

  return (
    <AccountLayout title={t('pageTitle')}>
      {summaryLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {summary && <MembershipSummaryCard summary={summary} onRedeemClick={() => setShowRedeemModal(true)} />}

      {showRedeemModal && <RedeemPointsModal onClose={() => setShowRedeemModal(false)} />}

      <PointsHistorySection />
    </AccountLayout>
  );
}

export default MyMembershipPage;
