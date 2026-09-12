import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { KioskShowtime } from '../types/kiosk.types';

export function ShowtimeStep({
  showtimes,
  isSuccess,
  onSelect,
  onBack,
}: {
  showtimes: KioskShowtime[];
  isSuccess: boolean;
  onSelect: (showtime: KioskShowtime) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation('kiosk');
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.showtime')}</h2>
      <div className="flex flex-wrap gap-3">
        {showtimes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s)}
            className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-white hover:border-accent/60"
          >
            {s.movie_date} · {s.time_begin}
          </button>
        ))}
        {isSuccess && showtimes.length === 0 && <p className="text-sm text-txt/60">{t('empty.showtimes')}</p>}
      </div>
      <Button type="button" variant="outline" className="mt-6" onClick={onBack}>
        {t('back')}
      </Button>
    </section>
  );
}
