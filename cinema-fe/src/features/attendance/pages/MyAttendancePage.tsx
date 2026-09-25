import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ErrorState } from '@/components/feedback/ErrorState';
import { getApiErrorMessage } from '@/lib/apiError';
import { AttendanceTable } from '../components/AttendanceTable';
import { ClockPanel } from '../components/ClockPanel';
import { HISTORY_PAGE_SIZE } from '../constants';
import { useMyAttendance, useTodayAttendance } from '../hooks/useAttendance';

// The employee's own attendance: today's clock on top, their own history below. Nothing here can
// name another employee — the backend only ever returns and acts on the caller's own record.
function MyAttendancePage() {
  const { t } = useTranslation('attendance');
  const [page, setPage] = useState(1);
  const today = useTodayAttendance();
  const history = useMyAttendance(page, HISTORY_PAGE_SIZE);
  const records = useMemo(() => history.data?.data ?? [], [history.data]);

  return (
    <AdminLayout breadcrumb={t('my.breadcrumb')} loading={today.isLoading}>
      <div className="space-y-6">
        {today.isError && <ErrorState message={getApiErrorMessage(today.error, t)} onRetry={() => today.refetch()} />}
        {today.data && <ClockPanel today={today.data} />}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('my.historyTitle')}</h2>
          <AttendanceTable
            records={records}
            page={page}
            totalPages={history.data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </section>
      </div>
    </AdminLayout>
  );
}

export default MyAttendancePage;
