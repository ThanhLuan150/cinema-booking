import { useTranslation } from 'react-i18next';
import { SeatGrid } from './SeatGrid';
import { SeatLegend } from './SeatLegend';

export function SeatMapCard({ scheduleId, roomId }: { scheduleId: number | null; roomId: number | null }) {
  const { t } = useTranslation('booking');

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
      <div className="mx-auto mb-3 h-3 w-4/5 rounded-full bg-white/70 [box-shadow:0_0_30px_8px_rgba(255,255,255,0.35)]" />
      <p className="mb-8 text-center text-xs uppercase tracking-widest text-txt/50">
        {t('bookSeat.screen')}
      </p>

      <SeatGrid scheduleId={scheduleId} roomId={roomId} />

      <SeatLegend />
    </div>
  );
}
