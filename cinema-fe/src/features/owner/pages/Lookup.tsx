import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { getApiErrorMessage } from '@/lib/apiError';
import { useLookupInvoice } from '../hooks/useLookupInvoice';
import { LookupForm } from './components/LookupForm';
import { LookupInvoiceCard } from './components/LookupInvoiceCard';

function BookingLookup() {
  const { t } = useTranslation('owner');
  const lookupMutation = useLookupInvoice();

  const invoice = lookupMutation.data;
  const error = lookupMutation.isError ? getApiErrorMessage(lookupMutation.error, t) : '';

  const handleSubmit = (values: { code: string }) => {
    lookupMutation.reset();
    lookupMutation.mutate(values.code.trim().toUpperCase());
  };

  return (
    <AdminLayout breadcrumb={t('bookingsLookup.breadcrumb')}>
      <LookupForm isPending={lookupMutation.isPending} onSubmit={handleSubmit} />

      {error && <p className="mt-4 text-red-400">{error}</p>}

      {invoice && <LookupInvoiceCard invoice={invoice} />}
    </AdminLayout>
  );
}

export default BookingLookup;
