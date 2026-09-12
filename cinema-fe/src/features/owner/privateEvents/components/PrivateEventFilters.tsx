import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import type { Cinema } from '@/types/entities';
import { ALL_BRANCHES, STATUSES } from '../constants';

interface PrivateEventFiltersProps {
  isAdmin: boolean;
  cinemas: Cinema[];
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
}

export function PrivateEventFilters({
  isAdmin,
  cinemas,
  selectedBranchId,
  onBranchChange,
  status,
  onStatusChange,
}: PrivateEventFiltersProps) {
  const { t } = useTranslation('privateEvents');

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="max-w-xs flex-1">
        <Select
          value={selectedBranchId}
          onChange={(e) => onBranchChange(e.target.value)}
          placeholder={t('admin.branchPlaceholder')}
          options={[
            ...(isAdmin ? [{ label: t('admin.allBranches'), value: ALL_BRANCHES }] : []),
            ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
          ]}
        />
      </div>
      <div className="max-w-xs flex-1">
        <Select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          placeholder={t('admin.statusFilter')}
          options={STATUSES.map((s) => ({ label: t(`status.${s}`), value: s }))}
        />
      </div>
    </div>
  );
}
