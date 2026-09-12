import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { Cinema, SupportTicketStatus } from '@/types/entities';
import { ALL_BRANCHES, STATUSES } from '../constants';

export function SupportTicketFilters({
  isEmployee,
  isAdmin,
  cinemas,
  selectedbranchId,
  statusFilter,
  canCreate,
  isAllBranches,
  onBranchChange,
  onStatusFilterChange,
  onCreate,
}: {
  isEmployee: boolean;
  isAdmin: boolean;
  cinemas: Cinema[];
  selectedbranchId: string;
  statusFilter: string;
  canCreate: boolean;
  isAllBranches: boolean;
  onBranchChange: (branchId: string) => void;
  onStatusFilterChange: (status: string) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation('customerService');
  const statusOptions = STATUSES.map((status: SupportTicketStatus) => ({ label: t(`status.${status}`), value: status }));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {!isEmployee && (
        <div className="max-w-xs flex-1">
          <Select
            value={selectedbranchId}
            onChange={(e) => onBranchChange(e.target.value)}
            placeholder={t('branchPlaceholder')}
            options={[
              ...(isAdmin ? [{ label: t('allBranches'), value: ALL_BRANCHES }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: c.id })),
            ]}
          />
        </div>
      )}
      <div className="max-w-xs flex-1">
        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          placeholder={t('statusFilterPlaceholder')}
          options={statusOptions}
        />
      </div>
      {canCreate && !isAllBranches && (
        <Button type="button" variant="danger" onClick={onCreate}>
          {t('newButton')}
        </Button>
      )}
    </div>
  );
}
