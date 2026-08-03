import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/apiError';
import { useLookupInvoice } from '../hooks/useLookupInvoice';
import { SEAT_TYPES } from '@/constants/seatType';

function BookingLookup() {
  const { t } = useTranslation('owner');
  const lookupMutation = useLookupInvoice();

  const STATUS_LABEL = t('bookingsLookup.statusLabels', { returnObjects: true }) as unknown as string[];
  const SEAT_TYPE_LABEL = t('bookingsLookup.seatTypeLabels', { returnObjects: true }) as unknown as string[];

  const invoice = lookupMutation.data;
  const error = lookupMutation.isError ? getApiErrorMessage(lookupMutation.error, t) : '';

  const validateLookup = (values: { code: string }) => {
    const errors: { code?: string } = {};
    if (!values.code.trim()) errors.code = t('bookingsLookup.validation.codeRequired');
    return errors;
  };

  const handleSubmit = (values: { code: string }) => {
    lookupMutation.reset();
    lookupMutation.mutate(values.code.trim().toUpperCase());
  };

  return (
    <AdminLayout breadcrumb={t('bookingsLookup.breadcrumb')}>
      <Formik initialValues={{ code: '' }} validate={validateLookup} onSubmit={handleSubmit}>
        {(formik) => (
          <Form className="flex max-w-md gap-2">
            <Field
              as={Input}
              name="code"
              placeholder={t('bookingsLookup.codePlaceholder')}
              className="flex-1"
              error={formik.submitCount > 0 ? formik.errors.code : undefined}
            />
            <Button type="submit" variant="danger" loading={lookupMutation.isPending}>
              {t('bookingsLookup.searchButton')}
            </Button>
          </Form>
        )}
      </Formik>

      {error && <p className="mt-4 text-red-400">{error}</p>}

      {invoice && (
        <div className="mt-6 max-w-md rounded-xl border border-border bg-surface p-5 text-white shadow-card">
          <p>
            <b>{t('bookingsLookup.ticketCode')}</b> {invoice.code}
          </p>
          <p>
            <b>{t('bookingsLookup.movie')}</b> {invoice.movie?.name}
          </p>
          <p>
            <b>{t('bookingsLookup.cinema')}</b> {invoice.cinema?.name}
          </p>
          <p>
            <b>{t('bookingsLookup.schedule')}</b> {invoice.schedule?.movie_date} · {invoice.schedule?.time_begin}
          </p>
          <p>
            <b>{t('bookingsLookup.seat')}</b> {invoice.ticket?.seat_code} ({SEAT_TYPE_LABEL[invoice.ticket?.seat_type ?? SEAT_TYPES.standard] ?? SEAT_TYPE_LABEL[SEAT_TYPES.standard]})
          </p>
          <p>
            <b>{t('bookingsLookup.status')}</b> {STATUS_LABEL[invoice.status]}
          </p>
          <p>
            <b>{t('bookingsLookup.totalPrice')}</b> {invoice.total_price.toLocaleString()}đ
          </p>
        </div>
      )}
    </AdminLayout>
  );
}

export default BookingLookup;
