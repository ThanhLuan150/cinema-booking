import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import type { AuditLog } from '@/types/entities';

export interface LogRowProps {
  log: AuditLog;
  isAllBranches: boolean;
  branchNameById: Map<number, string>;
  actionLabel: (action: string) => string;
  onView: (log: AuditLog) => void;
}

export const LogRow = ({ log, isAllBranches, branchNameById, actionLabel, onView }: LogRowProps) => {
  const { t } = useTranslation('owner');

  return (
    <tr>
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
          onClick={() => onView(log)}
        >
          {t('auditLog.view')}
        </button>
      </td>
    </tr>
  );
};
