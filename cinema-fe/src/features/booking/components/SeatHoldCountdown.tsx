import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface SeatHoldCountdownProps {
  expiresAt: string | null;
  onExpire: () => void;
}

const URGENT_THRESHOLD_MS = 30 * 1000;

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function SeatHoldCountdown({ expiresAt, onExpire }: SeatHoldCountdownProps) {
  const { t } = useTranslation('booking');
  const [remainingMs, setRemainingMs] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0,
  );
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    hasExpiredRef.current = false;
    if (!expiresAt) {
      setRemainingMs(0);
      return;
    }
    const target = new Date(expiresAt).getTime();
    setRemainingMs(target - Date.now());

    const interval = setInterval(() => {
      const remaining = target - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  if (!expiresAt) return null;

  const isUrgent = remainingMs <= URGENT_THRESHOLD_MS;

  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
        isUrgent ? 'border-red-500/60 bg-red-500/10 text-red-400' : 'border-accent/40 bg-accent/10 text-accent',
      )}
    >
      <span>{t('bookSeat.holdCountdown.label')}</span>
      <span className="font-mono font-semibold tabular-nums">{formatRemaining(remainingMs)}</span>
    </div>
  );
}
