import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { Cinema, KioskStatus } from '@/types/entities';
import { ALL_BRANCHES, KIOSK_STATUSES } from '../constants';

interface KioskFiltersProps {
  isAdmin: boolean;
  cinemas: Cinema[];
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  canManage: boolean;
  concreteBranchId: number | undefined;
  onAddClick: () => void;
}

export function KioskFilters({
  isAdmin,
  cinemas,
  selectedBranchId,
  onBranchChange,
  statusFilter,
  onStatusFilterChange,
  canManage,
  concreteBranchId,
  onAddClick,
}: KioskFiltersProps) {
  const { t } = useTranslation('owner');
  const statusOptions = KIOSK_STATUSES.map((s: KioskStatus) => ({ label: t(`kiosks.status.${s}`), value: s }));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="max-w-xs flex-1">
        <Select
          value={selectedBranchId}
          onChange={(e) => onBranchChange(e.target.value)}
          placeholder={t('kiosks.branchPlaceholder')}
          options={[
            ...(isAdmin ? [{ label: t('kiosks.allBranches'), value: ALL_BRANCHES }] : []),
            ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
          ]}
        />
      </div>
      <div className="max-w-xs flex-1">
        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          placeholder={t('kiosks.statusFilterPlaceholder')}
          options={statusOptions}
        />
      </div>
      {canManage && concreteBranchId && (
        <Button type="button" variant="danger" onClick={onAddClick}>
          {t('kiosks.addButton')}
        </Button>
      )}
    </div>
  );
}
