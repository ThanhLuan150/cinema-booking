import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { TiersTab } from '../components/TiersTab';
import { PlansTab } from '../components/PlansTab';
import { SubscriptionsTab } from '../components/SubscriptionsTab';

type Tab = 'tiers' | 'plans' | 'subscriptions';

// Super Admin: the tier ladder and its benefits, the subscription plan catalogue, and every
// customer's subscriptions (the server gates each with membershipLevel.manage / subscriptionPlan.manage /
// subscription.manage).
function MembershipAdminPage() {
  const { t } = useTranslation('membership');
  const [tab, setTab] = useState<Tab>('tiers');

  const tabButton = (value: Tab) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={
        tab === value
          ? 'border-b-2 border-accent px-4 py-2 text-sm font-semibold text-accent'
          : 'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-txt/60 hover:text-txt'
      }
    >
      {t(`admin.tabs.${value}`)}
    </button>
  );

  return (
    <AdminLayout breadcrumb={t('admin.breadcrumb')}>
      <div className="mb-6 flex gap-2 border-b border-border">
        {tabButton('tiers')}
        {tabButton('plans')}
        {tabButton('subscriptions')}
      </div>
      {tab === 'tiers' && <TiersTab />}
      {tab === 'plans' && <PlansTab />}
      {tab === 'subscriptions' && <SubscriptionsTab />}
    </AdminLayout>
  );
}

export default MembershipAdminPage;
