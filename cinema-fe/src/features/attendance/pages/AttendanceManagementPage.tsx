import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { getApiErrorMessage } from '@/lib/apiError';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { useMyEmployees } from '@/features/owner/hooks/useMyEmployees';
import type { Attendance, AttendanceStatus } from '@/types/entities';
import { AttendanceTable } from '../components/AttendanceTable';
import { CloseSessionModal } from '../components/CloseSessionModal';
import { MarkAttendanceModal } from '../components/MarkAttendanceModal';
import { ALL_BRANCHES, ATTENDANCE_STATUSES } from '../constants';
import { useAttendanceList } from '../hooks/useAttendance';

// Branch Admin: their own branch's attendance. Super Admin: every branch, or one. Each row is
// scoped by the backend, so picking a branch here only narrows the view — it can never widen it.
function AttendanceManagementPage() {
  const { t } = useTranslation('attendance');
  const isAdmin = useAuthRole() === ROLES.admin;
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('attendance.manage');

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [markOpen, setMarkOpen] = useState(false);
  const [closing, setClosing] = useState<Attendance | null>(null);

  useEffect(() => {
    if (selectedBranchId) return;
    if (isAdmin) setSelectedBranchId(ALL_BRANCHES);
    else if (cinemas.length > 0) setSelectedBranchId(String(cinemas[0].id));
  }, [cinemas, selectedBranchId, isAdmin]);

  const isAllBranches = selectedBranchId === ALL_BRANCHES;
  const branchParam = isAllBranches ? undefined : selectedBranchId || undefined;
  const concreteBranchId = branchParam;

  // Reversed dates would be a 400 from the backend; hold the request until the range is sane.
  const rangeInvalid = Boolean(from && to && from > to);

  const { data: employeesPage } = useMyEmployees(concreteBranchId, 1, FULL_LIST_FETCH_LIMIT);
  const employees = useMemo(() => employeesPage?.data ?? [], [employeesPage]);

  const filters = useMemo(
    () => ({
      status: (status || undefined) as AttendanceStatus | undefined,
      employeeId: employeeId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [status, employeeId, from, to],
  );

  const { data, isLoading, isError, error, refetch } = useAttendanceList(branchParam, page, DEFAULT_PAGE_SIZE, filters, {
    enabled: Boolean(selectedBranchId) && !rangeInvalid,
  });
  const records = useMemo(() => data?.data ?? [], [data]);

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <AdminLayout breadcrumb={t('admin.breadcrumb')} loading={isLoading}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Select
            label={t('admin.branch')}
            value={selectedBranchId}
            placeholder={t('admin.branchPlaceholder')}
            options={[
              ...(isAdmin ? [{ label: t('admin.allBranches'), value: ALL_BRANCHES }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
            ]}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setEmployeeId('');
              setPage(1);
            }}
          />
        </div>
        {concreteBranchId && (
          <div className="w-48">
            <Select
              label={t('admin.employee')}
              value={employeeId}
              placeholder={t('admin.allEmployees')}
              options={employees.map((e) => ({ label: e.name || e.employee_code, value: String(e.id) }))}
              onChange={(e) => resetPage(setEmployeeId)(e.target.value)}
            />
          </div>
        )}
        <div className="w-40">
          <Select
            label={t('admin.status')}
            value={status}
            placeholder={t('admin.allStatuses')}
            options={ATTENDANCE_STATUSES.map((s) => ({ label: t(`status.${s}`), value: s }))}
            onChange={(e) => resetPage(setStatus)(e.target.value)}
          />
        </div>
        <div className="w-44">
          <DateInput id="attendance-from" label={t('admin.from')} value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} />
        </div>
        <div className="w-44">
          <DateInput id="attendance-to" label={t('admin.to')} value={to} onChange={(e) => resetPage(setTo)(e.target.value)} />
        </div>
        {canManage && concreteBranchId && (
          <Button type="button" variant="outline" onClick={() => setMarkOpen(true)}>
            {t('admin.markAbsence')}
          </Button>
        )}
      </div>

      {rangeInvalid && <p className="mb-3 text-sm text-red-400">{t('admin.rangeInvalid')}</p>}
      {isError && <ErrorState message={getApiErrorMessage(error, t)} onRetry={() => refetch()} />}

      {!isError && (
        <AttendanceTable
          records={records}
          showEmployee
          showBranch={isAllBranches}
          onCloseSession={canManage ? setClosing : undefined}
          page={page}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}

      {markOpen && <MarkAttendanceModal employees={employees} onClose={() => setMarkOpen(false)} />}
      {closing && <CloseSessionModal record={closing} onClose={() => setClosing(null)} />}
    </AdminLayout>
  );
}

export default AttendanceManagementPage;
