import { useTranslation } from 'react-i18next';

export function RescheduleBanner({
  onAccept,
  onRefund,
}: {
  onAccept: () => void;
  onRefund: () => void;
}) {
  const { t } = useTranslation('booking');

  return (
    <div className="no-print mt-2 rounded-lg border border-amber-700/50 bg-amber-500/10 p-3">
      <p className="text-sm text-amber-300">{t('myBookings.rescheduleBanner.message')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          onClick={onAccept}
        >
          {t('myBookings.rescheduleBanner.acceptButton')}
        </button>
        <button
          type="button"
          className="rounded-lg border border-red-800/60 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
          onClick={onRefund}
        >
          {t('myBookings.rescheduleBanner.refundButton')}
        </button>
      </div>
    </div>
  );
}
