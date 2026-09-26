import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { DateInput } from '@/components/ui/DateInput';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { TimeInput } from '@/components/ui/TimeInput';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Attendance } from '@/types/entities';
import { useCloseAttendanceSession } from '../hooks/useAttendanceMutations';
import { formatClock, toOffsetTimestamp } from '../utils/format';

interface CloseSessionModalProps {
  record: Attendance;
  onClose: () => void;
}

// A manager's correction for a session the employee never clocked out of. The time is entered
// as the branch's wall clock and sent with that zone's offset attached, so it means the same
// instant no matter where the manager's browser is.
export function CloseSessionModal({ record, onClose }: CloseSessionModalProps) {
  const { t } = useTranslation('attendance');
  const closeSession = useCloseAttendanceSession();
  const [date, setDate] = useState(record.work_date);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');

  const clockOut = time ? toOffsetTimestamp(date, time, record.timezone) : null;
  const canSubmit = Boolean(clockOut && note.trim());

  const submit = async () => {
    if (!clockOut) return;
    try {
      await closeSession.mutateAsync({ id: record.id, clock_out: clockOut, note: note.trim() });
      toast.success(t('close.success'));
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={t('close.title')}>
      <div className="space-y-3">
        <Alert variant="info">
          {t('close.context', {
            employee: record.employee?.name || record.employee?.employee_code || `#${record.employee_id}`,
            clockIn: formatClock(record.clock_in, record.timezone),
            date: record.work_date,
          })}
        </Alert>
        <p className="text-sm text-txt/60">{t('close.timezoneHint', { timezone: record.timezone })}</p>
        <DateInput id="attendance-close-date" label={t('close.date')} value={date} onChange={(e) => setDate(e.target.value)} />
        <TimeInput id="attendance-close-time" label={t('close.time')} value={time} stepMinutes={5} onChange={(e) => setTime(e.target.value)} />
        <Textarea
          id="attendance-close-note"
          label={t('close.note')}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-end pt-2">
          <Button type="button" loading={closeSession.isPending} disabled={!canSubmit} onClick={submit}>
            {t('close.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
