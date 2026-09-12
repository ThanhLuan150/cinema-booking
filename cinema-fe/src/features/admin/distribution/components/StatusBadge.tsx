import { Badge } from '@/components/ui/Badge';

export function statusBadge(status: string, t: (k: string) => string) {
  return status === 'ACTIVE' ? (
    <Badge variant="success">{t('distribution.status.ACTIVE')}</Badge>
  ) : (
    <Badge variant="outline">{t('distribution.status.INACTIVE')}</Badge>
  );
}
