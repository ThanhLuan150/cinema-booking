import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { SEAT_TYPE_KEY } from '@/constants/seatType';
import type { PricingRule } from '@/types/entities';

interface PricingRulesTableProps {
  rules: PricingRule[];
  branchNameById: Map<number, string>;
  categoryNameById: Map<number, string>;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (id: number) => void;
  onToggleActive: (rule: PricingRule) => void;
  onDelete: (id: number) => void;
}

export function PricingRulesTable({
  rules,
  branchNameById,
  categoryNameById,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onToggleActive,
  onDelete,
}: PricingRulesTableProps) {
  const { t } = useTranslation('owner');

  const describeMatch = useCallback(
    (rule: PricingRule) => {
      const parts: string[] = [];
      if (rule.room_type) parts.push(rule.room_type);
      if (rule.seat_type !== null) parts.push(t(`pricingRules.seatTypeLabels.${SEAT_TYPE_KEY[rule.seat_type]}`));
      if (rule.category_id !== null) parts.push(categoryNameById.get(rule.category_id) ?? `#${rule.category_id}`);
      if (rule.day_type) parts.push(t(`pricingRules.dayTypeLabels.${rule.day_type}`));
      if (rule.time_start && rule.time_end) parts.push(`${rule.time_start}-${rule.time_end}`);
      if (rule.membership_level) parts.push(t(`pricingRules.membershipLabels.${rule.membership_level}`));
      return parts.length > 0 ? parts.join(' · ') : t('pricingRules.matchAny');
    },
    [categoryNameById, t],
  );

  const describeEffective = useCallback((rule: PricingRule) => {
    if (!rule.effective_from && !rule.effective_to) return '—';
    return `${rule.effective_from ?? '…'} → ${rule.effective_to ?? '…'}`;
  }, []);

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('pricingRules.headers.id'),
          t('pricingRules.headers.name'),
          t('pricingRules.headers.branch'),
          t('pricingRules.headers.match'),
          t('pricingRules.headers.price'),
          t('pricingRules.headers.priority'),
          t('pricingRules.headers.effective'),
          t('pricingRules.headers.status'),
          t('pricingRules.headers.actions'),
        ]}
      >
        {rules.map((rule) => (
          <tr key={rule.id}>
            <td>{rule.id}</td>
            <td>{rule.name}</td>
            <td>{rule.branch_id === null ? t('pricingRules.allBranchesOption') : branchNameById.get(rule.branch_id) || rule.branch_id}</td>
            <td>{describeMatch(rule)}</td>
            <td>{rule.price.toLocaleString()}đ</td>
            <td>{rule.priority}</td>
            <td>{describeEffective(rule)}</td>
            <td>
              <Badge variant={rule.active ? 'success' : 'default'}>
                {rule.active ? t('pricingRules.statusActive') : t('pricingRules.statusInactive')}
              </Badge>
            </td>
            <td className="flex gap-3">
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                onClick={() => onEdit(rule.id)}
              >
                {t('pricingRules.edit')}
              </button>
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                onClick={() => onToggleActive(rule)}
              >
                {rule.active ? t('pricingRules.deactivate') : t('pricingRules.activate')}
              </button>
              <button
                type="button"
                className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                onClick={() => onDelete(rule.id)}
              >
                {t('pricingRules.delete')}
              </button>
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
