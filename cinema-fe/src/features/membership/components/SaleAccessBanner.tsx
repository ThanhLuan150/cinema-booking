import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/Alert';
import { useSaleAccess } from '../hooks/useSubscriptions';

function formatInstant(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Priority Booking on the seat page. Only informs — holding a seat before the caller's window opens
// is refused by the server (SALE_NOT_OPEN) whatever this shows.
export function SaleAccessBanner({ scheduleId }: { scheduleId: number | null }) {
  const { t } = useTranslation('membership');
  const { data } = useSaleAccess(scheduleId);
  if (!data || !data.general_opens_at) return null;

  if (!data.open) {
    return (
      <Alert variant="warning" data-testid="sale-not-open">
        {t('checkout.saleNotOpen', { time: formatInstant(data.general_opens_at) })}
        {data.opens_at && data.opens_at !== data.general_opens_at && (
          <> {t('checkout.saleOpensForYou', { time: formatInstant(data.opens_at) })}</>
        )}
      </Alert>
    );
  }
  if (data.priority) {
    return (
      <Alert variant="success" data-testid="sale-priority">
        {t('checkout.salePriority', { time: formatInstant(data.general_opens_at) })}
      </Alert>
    );
  }
  return null;
}
