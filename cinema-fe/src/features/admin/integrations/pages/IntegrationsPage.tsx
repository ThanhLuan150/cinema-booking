import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { usePermissions } from '@/hooks/usePermissions';
import type { Tab } from '../types/integrations.types';
import { IntegrationsTab } from '../components/IntegrationsTab';
import { WebhooksTab } from '../components/WebhooksTab';

function IntegrationsPage() {
  const { t } = useTranslation('admin');
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('integration.manage');

  const [tab, setTab] = useState<Tab>('integrations');

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={
        tab === value
          ? 'border-b-2 border-accent px-4 py-2 text-sm font-semibold text-accent'
          : 'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-txt/60 hover:text-txt'
      }
    >
      {label}
    </button>
  );

  return (
    <AdminLayout breadcrumb={t('integrations.breadcrumb')}>
      <div className="mb-6 flex gap-2 border-b border-border">
        {tabButton('integrations', t('integrations.tabs.integrations'))}
        {tabButton('webhooks', t('integrations.tabs.webhooks'))}
      </div>

      {tab === 'webhooks' ? <WebhooksTab /> : <IntegrationsTab canManage={canManage} />}
    </AdminLayout>
  );
}

export default IntegrationsPage;
