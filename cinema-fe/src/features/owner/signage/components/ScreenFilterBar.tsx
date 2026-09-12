import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { Cinema } from '@/types/entities';
import { ALL_BRANCHES, SCREEN_STATUSES } from '../constants';

interface ScreenFilterBarProps {
  isAdmin: boolean;
  cinemas: Cinema[];
  selectedBranchId: string;
  onBranchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  canManage: boolean;
  concreteBranchId: number | undefined;
  onToggleContentLibrary: () => void;
  onAddScreen: () => void;
}

export function ScreenFilterBar({
  isAdmin,
  cinemas,
  selectedBranchId,
  onBranchChange,
  statusFilter,
  onStatusFilterChange,
  canManage,
  concreteBranchId,
  onToggleContentLibrary,
  onAddScreen,
}: ScreenFilterBarProps) {
  const { t } = useTranslation('owner');
  const statusOptions = SCREEN_STATUSES.map((s) => ({ label: t(`signage.screenStatus.${s}`), value: s }));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="max-w-xs flex-1">
        <Select
          value={selectedBranchId}
          onChange={(e) => onBranchChange(e.target.value)}
          placeholder={t('signage.branchPlaceholder')}
          options={[
            ...(isAdmin ? [{ label: t('signage.allBranches'), value: ALL_BRANCHES }] : []),
            ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
          ]}
        />
      </div>
      <div className="max-w-xs flex-1">
        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          placeholder={t('signage.statusFilterPlaceholder')}
          options={statusOptions}
        />
      </div>
      <Button type="button" variant="outline" onClick={onToggleContentLibrary}>
        {t('signage.contentLibrary')}
      </Button>
      {canManage && concreteBranchId && (
        <Button type="button" variant="danger" onClick={onAddScreen}>
          {t('signage.addScreen')}
        </Button>
      )}
    </div>
  );
}
