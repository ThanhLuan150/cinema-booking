import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { GLOBAL } from '../constants';

export interface FilterBarProps {
  cinemas: { id: number | string; name: string }[];
  isAdmin: boolean;
  selectedBranchId: string;
  onBranchChange: (value: string) => void;
  isGlobalView: boolean;
}

export function FilterBar({ cinemas, isAdmin, selectedBranchId, onBranchChange, isGlobalView }: FilterBarProps) {
  const { t } = useTranslation('owner');

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="max-w-xs flex-1">
        <Select
          id="system-config-branch"
          label={t('systemConfig.filters.branch')}
          value={selectedBranchId}
          onChange={(e) => onBranchChange(e.target.value)}
          options={[
            ...(isAdmin ? [{ label: t('systemConfig.filters.globalSettings'), value: GLOBAL }] : []),
            ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
          ]}
        />
      </div>
      {!isGlobalView && <p className="max-w-md text-xs text-txt/60">{t('systemConfig.branchViewHint')}</p>}
    </div>
  );
}
