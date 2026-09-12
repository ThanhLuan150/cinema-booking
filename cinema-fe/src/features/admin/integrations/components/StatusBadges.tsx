import { Badge } from '@/components/ui/Badge';
import type { WebhookStatus } from '@/types/entities';

export function statusBadge(status: string, t: (k: string) => string) {
  return status === 'ACTIVE' ? (
    <Badge variant="success">{t('integrations.status.ACTIVE')}</Badge>
  ) : (
    <Badge variant="outline">{t('integrations.status.INACTIVE')}</Badge>
  );
}

export function webhookStatusBadge(status: WebhookStatus, t: (k: string) => string) {
  const variant = status === 'SUCCESS' ? 'success' : status === 'FAILED' ? 'warning' : 'outline';
  return <Badge variant={variant}>{t(`integrations.webhooks.status.${status}`)}</Badge>;
}
