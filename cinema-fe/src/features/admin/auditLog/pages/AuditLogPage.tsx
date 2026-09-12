import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { AuditLog } from '@/types/entities';
import { useAuditLogs, useAuditLogMeta } from '../hooks/useAuditLogs';
import { FilterBar } from '../components/FilterBar';
import { LogRow } from '../components/LogRow';
import { DetailModal } from '../components/DetailModal';
import { ALL_BRANCHES, emptyFilters } from '../constants';
import type { FilterState } from '../types/auditLog.types';

function AuditLogPage() {
  const { t } = useTranslation('owner');
  const isAdmin = useAuthRole() === ROLES.admin;
  const { data: currentUser } = useCurrentUser();
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  const [page, setPage] = useState(1);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [detail, setDetail] = useState<AuditLog | null>(null);

  useEffect(() => {
    if (selectedBranchId) return;
    if (isAdmin) setSelectedBranchId(ALL_BRANCHES);
    else if (currentUser?.cinema_id) setSelectedBranchId(String(currentUser.cinema_id));
    else if (cinemas.length > 0) setSelectedBranchId(String(cinemas[0].id));
  }, [cinemas, selectedBranchId, isAdmin, currentUser]);

  const isAllBranches = selectedBranchId === ALL_BRANCHES;
  const branchParam = isAllBranches || !selectedBranchId ? undefined : selectedBranchId;

  const { data: meta } = useAuditLogMeta();
  const { data: logsPage, isLoading } = useAuditLogs(page, DEFAULT_PAGE_SIZE, {
    branchId: branchParam,
    entityType: filters.entityType || undefined,
    action: filters.action || undefined,
    performedBy: filters.performedBy || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  });
  const logs = logsPage?.data ?? [];

  const patchFilter = (patch: Partial<FilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const handleBranchChange = (value: string) => {
    setSelectedBranchId(value);
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
  };

  const actionLabel = (action: string) => t(`auditLog.actions.${action}`, { defaultValue: action.replace(/_/g, ' ') });

  return (
    <AdminLayout breadcrumb={t('auditLog.breadcrumb')} loading={isLoading}>
      <FilterBar
        isAdmin={isAdmin}
        cinemas={cinemas}
        selectedBranchId={selectedBranchId}
        onBranchChange={handleBranchChange}
        filters={filters}
        onFilterChange={patchFilter}
        onReset={handleResetFilters}
        meta={meta}
        actionLabel={actionLabel}
      />

      <DataTable
        headers={[
          t('auditLog.headers.time'),
          t('auditLog.headers.action'),
          t('auditLog.headers.entity'),
          ...(isAllBranches ? [t('auditLog.headers.branch')] : []),
          t('auditLog.headers.actor'),
          t('auditLog.headers.details'),
        ]}
      >
        {logs.map((log) => (
          <LogRow
            key={log.id}
            log={log}
            isAllBranches={isAllBranches}
            branchNameById={branchNameById}
            actionLabel={actionLabel}
            onView={setDetail}
          />
        ))}
      </DataTable>

      {!isLoading && logs.length === 0 && <p className="mt-4 text-sm text-txt/60">{t('auditLog.empty')}</p>}

      <Pagination page={page} totalPages={logsPage?.totalPages ?? 1} onPageChange={setPage} />

      <DetailModal detail={detail} onClose={() => setDetail(null)} branchNameById={branchNameById} />
    </AdminLayout>
  );
}

export default AuditLogPage;
