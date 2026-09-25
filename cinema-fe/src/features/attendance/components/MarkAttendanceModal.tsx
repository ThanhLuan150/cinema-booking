import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { DateInput } from '@/components/ui/DateInput';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { AttendanceStatus, Employee } from '@/types/entities';
import { MARKABLE_STATUSES } from '../constants';
import { useMarkAttendance } from '../hooks/useAttendanceMutations';

interface MarkAttendanceModalProps {
  employees: Employee[];
  onClose: () => void;
}

// Records a day the employee did not work — absent, or on (possibly future) leave.
export function MarkAttendanceModal({ employees, onClose }: MarkAttendanceModalProps) {
  const { t } = useTranslation('attendance');
  const mark = useMarkAttendance();
  const [employeeId, setEmployeeId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [status, setStatus] = useState<Extract<AttendanceStatus, 'ABSENT' | 'ON_LEAVE'>>('ABSENT');
  const [note, setNote] = useState('');

  const canSubmit = Boolean(employeeId && workDate);

  const submit = async () => {
    try {
      await mark.mutateAsync({
        employee_id: Number(employeeId),
        work_date: workDate,
        status,
        note: note.trim() || undefined,
      });
      toast.success(t('mark.success'));
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={t('mark.title')}>
      <div className="space-y-3">
        <Select
          label={t('mark.employee')}
          value={employeeId}
          placeholder={t('mark.employeePlaceholder')}
          options={employees
            .filter((e) => e.status === 1)
            .map((e) => ({ label: e.name || e.employee_code, value: String(e.id) }))}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
        <DateInput id="attendance-mark-date" label={t('mark.date')} value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
        <Select
          label={t('mark.status')}
          value={status}
          options={MARKABLE_STATUSES.map((s) => ({ label: t(`status.${s}`), value: s }))}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        />
        <Textarea
          id="attendance-mark-note"
          label={t('mark.note')}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-end pt-2">
          <Button type="button" loading={mark.isPending} disabled={!canSubmit} onClick={submit}>
            {t('mark.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
