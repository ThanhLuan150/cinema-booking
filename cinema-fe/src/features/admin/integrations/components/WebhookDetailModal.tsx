import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import type { Webhook } from '@/types/entities';
import { webhookStatusBadge } from './StatusBadges';

export function WebhookDetailModal({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
  const { t } = useTranslation('admin');
  return (
    <Modal open onClose={onClose} title={t('integrations.webhooks.detailTitle', { id: webhook.id })} className="max-w-2xl">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-txt/50">{t('integrations.webhooks.headers.provider')}</div>
            <div className="font-medium">{webhook.provider}</div>
          </div>
          <div>
            <div className="text-txt/50">{t('integrations.webhooks.headers.event')}</div>
            <div className="font-medium">{webhook.event}</div>
          </div>
          <div>
            <div className="text-txt/50">{t('integrations.webhooks.headers.status')}</div>
            <div>{webhookStatusBadge(webhook.status, t)}</div>
          </div>
          <div>
            <div className="text-txt/50">{t('integrations.webhooks.headers.attempts')}</div>
            <div className="font-medium">
              {webhook.attempts}/{webhook.max_attempts}
            </div>
          </div>
        </div>
        {webhook.last_error && (
          <div>
            <div className="text-txt/50">{t('integrations.webhooks.lastError')}</div>
            <div className="mt-1 rounded-lg bg-red-500/10 p-2 font-mono text-xs text-red-400">{webhook.last_error}</div>
          </div>
        )}
        <div>
          <div className="text-txt/50">{t('integrations.webhooks.payload')}</div>
          <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-surface-soft p-2 text-xs">
            {JSON.stringify(webhook.payload, null, 2)}
          </pre>
        </div>
      </div>
    </Modal>
  );
}
