import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { AuditLog } from '@/types/entities';
import { useAuditLogs, useAuditLogMeta } from '../hooks/useAuditLogs';

const ALL_BRANCHES = 'ALL';

interface FilterState {
  entityType: string;
  action: string;
  performedBy: string;
  from: string;
  to: string;
}

const emptyFilters: FilterState = { entityType: '', action: '', performedBy: '', from: '', to: '' };

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

  const actionLabel = (action: string) => t(`auditLog.actions.${action}`, { defaultValue: action.replace(/_/g, ' ') });

  return (
    <AdminLayout breadcrumb={t('auditLog.breadcrumb')} loading={isLoading}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <Select
            id="audit-filter-branch"
            label={t('auditLog.filters.branch')}
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setPage(1);
            }}
            options={[
              ...(isAdmin ? [{ label: t('auditLog.filters.allBranches'), value: ALL_BRANCHES }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
            ]}
          />
        </div>
        <div className="max-w-xs flex-1">
          <Select
            id="audit-filter-entity-type"
            label={t('auditLog.filters.entityType')}
            value={filters.entityType}
            onChange={(e) => patchFilter({ entityType: e.target.value })}
            placeholder={t('auditLog.filters.any')}
            options={(meta?.entityTypes ?? []).map((et) => ({ label: et, value: et }))}
          />
        </div>
        <div className="max-w-xs flex-1">
          <Select
            id="audit-filter-action"
            label={t('auditLog.filters.action')}
            value={filters.action}
            onChange={(e) => patchFilter({ action: e.target.value })}
            placeholder={t('auditLog.filters.any')}
            options={(meta?.actions ?? []).map((a) => ({ label: actionLabel(a), value: a }))}
          />
        </div>
        <div className="max-w-xs flex-1">
          <Input
            id="audit-filter-actor"
            label={t('auditLog.filters.actor')}
            value={filters.performedBy}
            inputMode="numeric"
            onChange={(e) => patchFilter({ performedBy: e.target.value.replace(/\D/g, '') })}
          />
        </div>
        <div className="max-w-xs flex-1">
          <DateInput
            id="audit-filter-from"
            label={t('auditLog.filters.from')}
            value={filters.from}
            onChange={(e) => patchFilter({ from: e.target.value })}
          />
        </div>
        <div className="max-w-xs flex-1">
          <DateInput
            id="audit-filter-to"
            label={t('auditLog.filters.to')}
            value={filters.to}
            onChange={(e) => patchFilter({ to: e.target.value })}
          />
        </div>
        <Button type="button" variant="outline" onClick={() => { setFilters(emptyFilters); setPage(1); }}>
          {t('auditLog.filters.reset')}
        </Button>
      </div>

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
          <tr key={log.id}>
            <td className="whitespace-nowrap text-sm">{new Date(log.createdAt).toLocaleString()}</td>
            <td>
              <Badge variant="default">{actionLabel(log.action)}</Badge>
            </td>
            <td className="text-sm">
              {log.entity_type} <span className="text-txt/50">#{log.entity_id}</span>
            </td>
            {isAllBranches && (
              <td className="text-sm">
                {log.branch_id ? branchNameById.get(log.branch_id) || `#${log.branch_id}` : t('auditLog.system')}
              </td>
            )}
            <td className="text-sm">{log.performed_by ? `#${log.performed_by}` : t('auditLog.systemActor')}</td>
            <td>
              <button
                type="button"
                className="text-sm font-medium text-accent hover:text-accent-hover"
                onClick={() => setDetail(log)}
              >
                {t('auditLog.view')}
              </button>
            </td>
          </tr>
        ))}
      </DataTable>

      {!isLoading && logs.length === 0 && <p className="mt-4 text-sm text-txt/60">{t('auditLog.empty')}</p>}

      <Pagination page={page} totalPages={logsPage?.totalPages ?? 1} onPageChange={setPage} />

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={t('auditLog.detailTitle', { id: detail.id })} className="max-w-lg">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-txt/60">{t('auditLog.headers.action')}</dt>
              <dd className="font-medium">{detail.action}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-txt/60">{t('auditLog.headers.entity')}</dt>
              <dd>{detail.entity_type} #{detail.entity_id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-txt/60">{t('auditLog.headers.actor')}</dt>
              <dd>{detail.performed_by ? `#${detail.performed_by}` : t('auditLog.systemActor')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-txt/60">{t('auditLog.headers.branch')}</dt>
              <dd>{detail.branch_id ? branchNameById.get(detail.branch_id) || `#${detail.branch_id}` : t('auditLog.system')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-txt/60">{t('auditLog.headers.time')}</dt>
              <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
            </div>
            {detail.reason && (
              <div className="flex justify-between gap-4">
                <dt className="text-txt/60">{t('auditLog.reason')}</dt>
                <dd className="text-right">{detail.reason}</dd>
              </div>
            )}
          </dl>
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-txt/50">{t('auditLog.metadata')}</p>
            <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-surface p-3 text-xs">
              {JSON.stringify(detail.metadata ?? {}, null, 2)}
            </pre>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

export default AuditLogPage;
