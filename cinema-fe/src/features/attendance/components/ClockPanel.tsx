import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { TodayAttendance } from '@/types/entities';
import { SESSION_STATE_VARIANT, STATUS_VARIANT } from '../constants';
import { useClockIn, useClockOut, useEndBreak, useStartBreak } from '../hooks/useAttendanceMutations';
import { formatClock, formatMinutes } from '../utils/format';

interface ClockPanelProps {
  today: TodayAttendance;
}

function Timeline({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[6rem]">
      <div className="text-xs uppercase tracking-wider text-txt/50">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// The employee's own clock. Which buttons are live follows the session state the backend
// reports; the backend still enforces the same rules, so a stale button is answered with a
// clear message rather than trusted.
export function ClockPanel({ today }: ClockPanelProps) {
  const { t } = useTranslation('attendance');
  const clockIn = useClockIn();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  const clockOut = useClockOut();

  const { session_state: state, attendance, timezone } = today;
  const busy = clockIn.isPending || startBreak.isPending || endBreak.isPending || clockOut.isPending;

  const run = async (action: () => Promise<unknown>, successKey: string) => {
    try {
      await action();
      toast.success(t(successKey));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  // The open session may belong to an earlier day (a clock-out that was forgotten).
  const staleSession = Boolean(attendance && state !== 'CLOCKED_OUT' && attendance.work_date !== today.work_date);

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{t('clock.title')}</h2>
            <p className="text-sm text-txt/60">
              {t('clock.workDay', { date: today.work_date })} · {t('clock.timezone', { timezone })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={SESSION_STATE_VARIANT[state]}>{t(`sessionState.${state}`)}</Badge>
            {attendance && attendance.clock_in && (
              <Badge variant={STATUS_VARIANT[attendance.status]}>{t(`status.${attendance.status}`)}</Badge>
            )}
          </div>
        </div>

        {staleSession && attendance && (
          <Alert variant="warning">{t('clock.staleSession', { date: attendance.work_date })}</Alert>
        )}
        {attendance && !attendance.clock_in && (
          <Alert variant="info">{t('clock.recordedAs', { status: t(`status.${attendance.status}`) })}</Alert>
        )}

        {attendance && attendance.clock_in && (
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Timeline label={t('clock.clockIn')} value={formatClock(attendance.clock_in, timezone)} />
            <Timeline label={t('clock.breakStart')} value={formatClock(attendance.break_start, timezone)} />
            <Timeline label={t('clock.breakEnd')} value={formatClock(attendance.break_end, timezone)} />
            <Timeline label={t('clock.clockOut')} value={formatClock(attendance.clock_out, timezone)} />
            <Timeline label={t('clock.worked')} value={formatMinutes(attendance.worked_minutes)} />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {state === 'NOT_STARTED' && (
            <Button
              type="button"
              loading={clockIn.isPending}
              disabled={busy || Boolean(attendance)}
              onClick={() => run(() => clockIn.mutateAsync(timezone), 'clock.clockInSuccess')}
            >
              {t('clock.clockInAction')}
            </Button>
          )}

          {state === 'WORKING' && (
            <>
              <Button
                type="button"
                variant="secondary"
                loading={startBreak.isPending}
                disabled={busy || Boolean(attendance?.break_start)}
                onClick={() => run(() => startBreak.mutateAsync(timezone), 'clock.breakStartSuccess')}
              >
                {t('clock.breakAction')}
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={clockOut.isPending}
                disabled={busy}
                onClick={() => run(() => clockOut.mutateAsync(timezone), 'clock.clockOutSuccess')}
              >
                {t('clock.clockOutAction')}
              </Button>
            </>
          )}

          {state === 'ON_BREAK' && (
            <>
              <Button
                type="button"
                loading={endBreak.isPending}
                disabled={busy}
                onClick={() => run(() => endBreak.mutateAsync(timezone), 'clock.breakEndSuccess')}
              >
                {t('clock.resumeAction')}
              </Button>
              <Button type="button" variant="danger" disabled title={t('clock.endBreakFirst')}>
                {t('clock.clockOutAction')}
              </Button>
            </>
          )}

          {state === 'CLOCKED_OUT' && <p className="text-sm text-txt/70">{t('clock.dayComplete')}</p>}
        </div>
        {state === 'ON_BREAK' && <p className="text-sm text-txt/60">{t('clock.endBreakFirst')}</p>}
        {state === 'WORKING' && attendance?.break_start && (
          <p className="text-sm text-txt/60">{t('clock.breakTaken')}</p>
        )}
      </CardBody>
    </Card>
  );
}
