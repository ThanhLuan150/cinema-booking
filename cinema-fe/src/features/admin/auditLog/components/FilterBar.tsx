import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import type { AuditLogMeta, Cinema } from '@/types/entities';
import { ALL_BRANCHES } from '../constants';
import type { FilterState } from '../types/auditLog.types';

export interface FilterBarProps {
  isAdmin: boolean;
  cinemas: Cinema[];
  selectedBranchId: string;
  onBranchChange: (value: string) => void;
  filters: FilterState;
  onFilterChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
  meta?: AuditLogMeta;
  actionLabel: (action: string) => string;
}

export const FilterBar = ({
  isAdmin,
  cinemas,
  selectedBranchId,
  onBranchChange,
  filters,
  onFilterChange,
  onReset,
  meta,
  actionLabel,
}: FilterBarProps) => {
  const { t } = useTranslation('owner');

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="max-w-xs flex-1">
        <Select
          id="audit-filter-branch"
          label={t('auditLog.filters.branch')}
          value={selectedBranchId}
          onChange={(e) => onBranchChange(e.target.value)}
          options={[
            ...(isAdmin ? [{ label: t('auditLog.filters.allBranches'), value: ALL_BRANCHES }] : []),
            ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
          ]}
        />
      </div>
      <div className="max-w-xs flex-1">
        <Select
          id="audit-filter-entity-type"
          label={t('auditLog.filters.entityType')}
          value={filters.entityType}
          onChange={(e) => onFilterChange({ entityType: e.target.value })}
          placeholder={t('auditLog.filters.any')}
          options={(meta?.entityTypes ?? []).map((et) => ({ label: et, value: et }))}
        />
      </div>
      <div className="max-w-xs flex-1">
        <Select
          id="audit-filter-action"
          label={t('auditLog.filters.action')}
          value={filters.action}
          onChange={(e) => onFilterChange({ action: e.target.value })}
          placeholder={t('auditLog.filters.any')}
          options={(meta?.actions ?? []).map((a) => ({ label: actionLabel(a), value: a }))}
        />
      </div>
      <div className="max-w-xs flex-1">
        <Input
          id="audit-filter-actor"
          label={t('auditLog.filters.actor')}
          value={filters.performedBy}
          inputMode="numeric"
          onChange={(e) => onFilterChange({ performedBy: e.target.value.replace(/\D/g, '') })}
        />
      </div>
      <div className="max-w-xs flex-1">
        <DateInput
          id="audit-filter-from"
          label={t('auditLog.filters.from')}
          value={filters.from}
          onChange={(e) => onFilterChange({ from: e.target.value })}
        />
      </div>
      <div className="max-w-xs flex-1">
        <DateInput
          id="audit-filter-to"
          label={t('auditLog.filters.to')}
          value={filters.to}
          onChange={(e) => onFilterChange({ to: e.target.value })}
        />
      </div>
      <Button type="button" variant="outline" onClick={onReset}>
        {t('auditLog.filters.reset')}
      </Button>
    </div>
  );
};
