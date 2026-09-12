import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { usePermissions } from '@/hooks/usePermissions';
import type { Tab } from '../types/distribution.types';
import { DistributorsTab } from '../components/DistributorsTab';
import { ReleasesTab } from '../components/ReleasesTab';

function DistributionPage() {
  const { t } = useTranslation('admin');
  const { hasPermission } = usePermissions();
  const canSeeDistributors = hasPermission('distributor.read');
  const canManageDistributors = hasPermission('distributor.manage');
  const canManageReleases = hasPermission('movieRelease.manage');

  const [tab, setTab] = useState<Tab>('releases');
  const activeTab: Tab = tab === 'distributors' && !canSeeDistributors ? 'releases' : tab;

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={
        activeTab === value
          ? 'border-b-2 border-accent px-4 py-2 text-sm font-semibold text-accent'
          : 'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-txt/60 hover:text-txt'
      }
    >
      {label}
    </button>
  );

  return (
    <AdminLayout breadcrumb={t('distribution.breadcrumb')}>
      {canSeeDistributors && (
        <div className="mb-6 flex gap-2 border-b border-border">
          {tabButton('releases', t('distribution.tabs.releases'))}
          {tabButton('distributors', t('distribution.tabs.distributors'))}
        </div>
      )}

      {activeTab === 'distributors' && canSeeDistributors ? (
        <DistributorsTab canManage={canManageDistributors} />
      ) : (
        <ReleasesTab canManage={canManageReleases} />
      )}
    </AdminLayout>
  );
}

export default DistributionPage;
