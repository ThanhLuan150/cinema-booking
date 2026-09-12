import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ALL_BRANCHES } from '../constants';

interface MaintenanceToolbarProps {
  isEmployee: boolean;
  isAdmin: boolean;
  cinemas: { id: number; name: string }[];
  selectedbranchId: string;
  onBranchChange: (branchId: string) => void;
  statusOptions: { label: string; value: string }[];
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  canCreate: boolean;
  onAdd: () => void;
}

export function MaintenanceToolbar({
  isEmployee,
  isAdmin,
  cinemas,
  selectedbranchId,
  onBranchChange,
  statusOptions,
  statusFilter,
  onStatusFilterChange,
  canCreate,
  onAdd,
}: MaintenanceToolbarProps) {
  const { t } = useTranslation('owner');
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {!isEmployee && (
        <div className="max-w-xs flex-1">
          <Select
            value={selectedbranchId}
            onChange={(e) => onBranchChange(e.target.value)}
            placeholder={t('maintenance.branchPlaceholder')}
            options={[
              ...(isAdmin ? [{ label: t('maintenance.allBranches'), value: ALL_BRANCHES }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: c.id })),
            ]}
          />
        </div>
      )}
      <div className="max-w-xs flex-1">
        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          placeholder={t('maintenance.statusFilterPlaceholder')}
          options={statusOptions}
        />
      </div>
      {canCreate && (
        <Button type="button" variant="danger" onClick={onAdd}>
          {t('maintenance.addButton')}
        </Button>
      )}
    </div>
  );
}
