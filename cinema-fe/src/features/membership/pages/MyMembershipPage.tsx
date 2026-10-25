import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { useMyMembership } from '../hooks/useMyMembership';
import { useMembershipDetails } from '../hooks/useSubscriptions';
import { MembershipSummaryCard } from '../components/MembershipSummaryCard';
import { RedeemPointsModal } from '../components/RedeemPointsModal';
import { PointsHistorySection } from '../components/PointsHistorySection';
import { TierBenefitsCard } from '../components/TierBenefitsCard';
import { SubscriptionSection } from '../components/SubscriptionSection';

function MyMembershipPage() {
  const { t } = useTranslation('membership');
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useMyMembership();
  const { data: details } = useMembershipDetails();

  return (
    <AccountLayout title={t('pageTitle')}>
      {summaryLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {summary && <MembershipSummaryCard summary={summary} onRedeemClick={() => setShowRedeemModal(true)} />}

      {details && <TierBenefitsCard membership={details} />}
      {details && <SubscriptionSection membership={details} />}

      {showRedeemModal && <RedeemPointsModal onClose={() => setShowRedeemModal(false)} />}

      <PointsHistorySection />
    </AccountLayout>
  );
}

export default MyMembershipPage;
