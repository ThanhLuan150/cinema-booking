import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { MaintenanceRequest } from '@/types/entities';
import { STATUS_VARIANT } from '../constants';

interface MaintenanceTableProps {
  requests: MaintenanceRequest[];
  isAllBranches: boolean;
  branchNameById: Map<number, string>;
  employeeNameById: Map<number, string>;
  hasPermission: (code: string) => boolean;
  describeResource: (r: MaintenanceRequest) => string;
  onAssign: (id: number) => void;
  onStart: (id: number) => void;
  onResolve: (id: number) => void;
  onClose: (id: number) => void;
  onDelete: (id: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function MaintenanceTable({
  requests,
  isAllBranches,
  branchNameById,
  employeeNameById,
  hasPermission,
  describeResource,
  onAssign,
  onStart,
  onResolve,
  onClose,
  onDelete,
  page,
  totalPages,
  onPageChange,
}: MaintenanceTableProps) {
  const { t } = useTranslation('owner');

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('maintenance.headers.id'),
          ...(isAllBranches ? [t('maintenance.headers.branch')] : []),
          t('maintenance.headers.resource'),
          t('maintenance.headers.title'),
          t('maintenance.headers.assignee'),
          t('maintenance.headers.status'),
          t('maintenance.headers.actions'),
        ]}
      >
        {requests.map((r) => (
          <tr key={r.id}>
            <td>{r.id}</td>
            {isAllBranches && <td>{branchNameById.get(r.branch_id) || r.branch_id}</td>}
            <td>{describeResource(r)}</td>
            <td>{r.title}</td>
            <td>{r.assigned_employee_id ? employeeNameById.get(r.assigned_employee_id) || `#${r.assigned_employee_id}` : t('maintenance.unassigned')}</td>
            <td>
              <Badge variant={STATUS_VARIANT[r.status]}>{t(`maintenance.status.${r.status}`)}</Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              {(r.status === 'OPEN' || r.status === 'ASSIGNED') && hasPermission('maintenance.assign') && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => onAssign(r.id)}
                >
                  {r.status === 'OPEN' ? t('maintenance.assign') : t('maintenance.reassign')}
                </button>
              )}
              {r.status === 'ASSIGNED' && hasPermission('maintenance.update') && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => onStart(r.id)}
                >
                  {t('maintenance.start')}
                </button>
              )}
              {r.status === 'IN_PROGRESS' && hasPermission('maintenance.update') && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => onResolve(r.id)}
                >
                  {t('maintenance.resolve')}
                </button>
              )}
              {r.status === 'RESOLVED' && hasPermission('maintenance.close') && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => onClose(r.id)}
                >
                  {t('maintenance.close')}
                </button>
              )}
              {r.status === 'OPEN' && hasPermission('maintenance.delete') && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => onDelete(r.id)}
                >
                  {t('maintenance.delete')}
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
