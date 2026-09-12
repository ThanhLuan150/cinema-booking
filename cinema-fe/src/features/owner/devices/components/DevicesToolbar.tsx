import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { Cinema } from '@/types/entities';
import { ALL_BRANCHES, DEVICE_STATUSES } from '../constants';

interface DevicesToolbarProps {
  isAdmin: boolean;
  cinemas: Cinema[];
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  canManageEntrances: boolean;
  showEntrances: boolean;
  onToggleEntrances: () => void;
  canManage: boolean;
  concreteBranchId: number | undefined;
  onOpenCreateDevice: () => void;
}

export function DevicesToolbar({
  isAdmin,
  cinemas,
  selectedBranchId,
  onBranchChange,
  statusFilter,
  onStatusFilterChange,
  canManageEntrances,
  showEntrances,
  onToggleEntrances,
  canManage,
  concreteBranchId,
  onOpenCreateDevice,
}: DevicesToolbarProps) {
  const { t } = useTranslation('owner');

  const statusOptions = DEVICE_STATUSES.map((s) => ({ label: t(`devices.status.${s}`), value: s }));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="max-w-xs flex-1">
        <Select
          value={selectedBranchId}
          onChange={(e) => onBranchChange(e.target.value)}
          placeholder={t('devices.branchPlaceholder')}
          options={[
            ...(isAdmin ? [{ label: t('devices.allBranches'), value: ALL_BRANCHES }] : []),
            ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
          ]}
        />
      </div>
      <div className="max-w-xs flex-1">
        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          placeholder={t('devices.statusFilterPlaceholder')}
          options={statusOptions}
        />
      </div>
      {canManageEntrances && (
        <Button type="button" variant="outline" onClick={onToggleEntrances}>
          {t('devices.manageEntrances')}
        </Button>
      )}
      {canManage && concreteBranchId && (
        <Button type="button" variant="danger" onClick={onOpenCreateDevice}>
          {t('devices.addButton')}
        </Button>
      )}
    </div>
  );
}
