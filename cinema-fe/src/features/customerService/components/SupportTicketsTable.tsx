import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { SupportTicket } from '@/types/entities';
import { STATUS_VARIANT } from '../constants';
import { CustomerLabel } from './CustomerLabel';

export function SupportTicketsTable({
  tickets,
  isAllBranches,
  branchNameById,
  employeeNameById,
  hasPermission,
  page,
  totalPages,
  onPageChange,
  onClaim,
  onAssign,
  onResolve,
  onClose,
  onDelete,
}: {
  tickets: SupportTicket[];
  isAllBranches: boolean;
  branchNameById: Map<number, string>;
  employeeNameById: Map<number, string>;
  hasPermission: (permission: string) => boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onClaim: (id: number) => void;
  onAssign: (id: number) => void;
  onResolve: (id: number) => void;
  onClose: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation('customerService');

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('headers.id'),
          ...(isAllBranches ? [t('headers.branch')] : []),
          t('headers.customer'),
          t('headers.category'),
          t('headers.subject'),
          t('headers.assignee'),
          t('headers.status'),
          t('headers.actions'),
        ]}
      >
        {tickets.map((ticket: SupportTicket) => (
          <tr key={ticket.id}>
            <td>{ticket.id}</td>
            {isAllBranches && <td>{branchNameById.get(ticket.branch_id) || ticket.branch_id}</td>}
            <td>
              <CustomerLabel customerId={ticket.customer_id} />
            </td>
            <td>{t(`category.${ticket.category}`)}</td>
            <td>{ticket.subject}</td>
            <td>{ticket.assigned_employee_id ? employeeNameById.get(ticket.assigned_employee_id) || `#${ticket.assigned_employee_id}` : t('unassigned')}</td>
            <td>
              <Badge variant={STATUS_VARIANT[ticket.status]}>{t(`status.${ticket.status}`)}</Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              {ticket.status === 'OPEN' && hasPermission('supportTicket.update') && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => onClaim(ticket.id)}
                >
                  {t('claim')}
                </button>
              )}
              {(ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') && hasPermission('supportTicket.assign') && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => onAssign(ticket.id)}
                >
                  {t('assign')}
                </button>
              )}
              {ticket.status === 'IN_PROGRESS' && hasPermission('supportTicket.update') && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => onResolve(ticket.id)}
                >
                  {t('resolve')}
                </button>
              )}
              {ticket.status === 'RESOLVED' && hasPermission('supportTicket.close') && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => onClose(ticket.id)}
                >
                  {t('close')}
                </button>
              )}
              {ticket.status === 'OPEN' && hasPermission('supportTicket.delete') && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => onDelete(ticket.id)}
                >
                  {t('delete')}
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
