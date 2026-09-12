import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { Cinema } from '@/types/entities';
import { ALL_BRANCHES, GLOBAL, STATES, STATUSES } from '../constants';

interface CampaignFilterBarProps {
  isAdmin: boolean;
  cinemas: Cinema[];
  scope: string;
  onScopeChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  stateFilter: string;
  onStateFilterChange: (value: string) => void;
  canManage: boolean;
  createBranchId: number | null | undefined;
  onAdd: () => void;
}

export function CampaignFilterBar({
  isAdmin,
  cinemas,
  scope,
  onScopeChange,
  statusFilter,
  onStatusFilterChange,
  stateFilter,
  onStateFilterChange,
  canManage,
  createBranchId,
  onAdd,
}: CampaignFilterBarProps) {
  const { t } = useTranslation('owner');

  const scopeOptions = [
    ...(isAdmin ? [{ label: t('campaigns.allBranches'), value: ALL_BRANCHES }] : []),
    ...(isAdmin ? [{ label: t('campaigns.globalScope'), value: GLOBAL }] : []),
    ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="max-w-xs flex-1">
        <Select
          value={scope}
          onChange={(e) => onScopeChange(e.target.value)}
          placeholder={t('campaigns.scopePlaceholder')}
          options={scopeOptions}
        />
      </div>
      <div className="max-w-[12rem] flex-1">
        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          placeholder={t('campaigns.statusFilterPlaceholder')}
          options={STATUSES.map((s) => ({ label: t(`campaigns.status.${s}`), value: s }))}
        />
      </div>
      <div className="max-w-[12rem] flex-1">
        <Select
          value={stateFilter}
          onChange={(e) => onStateFilterChange(e.target.value)}
          placeholder={t('campaigns.stateFilterPlaceholder')}
          options={STATES.map((s) => ({ label: t(`campaigns.state.${s}`), value: s }))}
        />
      </div>
      {canManage && createBranchId !== undefined && (
        <Button type="button" variant="danger" onClick={onAdd}>
          {t('campaigns.add')}
        </Button>
      )}
    </div>
  );
}
