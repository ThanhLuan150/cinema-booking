import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { PROMOTION_DISCOUNT_TYPE } from '@/constants/promotionDiscountType';
import type { Promotion } from '@/types/entities';

interface PromotionsTableProps {
  promotions: Promotion[];
  describeScope: (promotion: Promotion) => string;
  onEdit: (id: number) => void;
  onToggleActive: (promotion: Promotion) => void;
  onDelete: (id: number) => void;
}

export function PromotionsTable({ promotions, describeScope, onEdit, onToggleActive, onDelete }: PromotionsTableProps) {
  const { t } = useTranslation('owner');

  return (
    <DataTable
      headers={[
        t('promotions.headers.id'),
        t('promotions.headers.code'),
        t('promotions.headers.name'),
        t('promotions.headers.scope'),
        t('promotions.headers.discount'),
        t('promotions.headers.used'),
        t('promotions.headers.period'),
        t('promotions.headers.status'),
        t('promotions.headers.actions'),
      ]}
    >
      {promotions.map((promotion) => (
        <tr key={promotion.id}>
          <td>{promotion.id}</td>
          <td>{promotion.code}</td>
          <td>{promotion.name}</td>
          <td>{describeScope(promotion)}</td>
          <td>
            {promotion.discount_type === PROMOTION_DISCOUNT_TYPE.PERCENTAGE
              ? `${promotion.discount_value}%`
              : `${promotion.discount_value.toLocaleString()}đ`}
          </td>
          <td>
            {promotion.used_count}
            {promotion.usage_limit !== null ? `/${promotion.usage_limit}` : ''}
          </td>
          <td>
            {new Date(promotion.start_at).toLocaleDateString()} → {new Date(promotion.end_at).toLocaleDateString()}
          </td>
          <td>
            <Badge variant={promotion.status === 'ACTIVE' ? 'success' : 'default'}>
              {promotion.status === 'ACTIVE' ? t('promotions.statusActive') : t('promotions.statusInactive')}
            </Badge>
          </td>
          <td className="flex gap-3">
            <button
              type="button"
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              onClick={() => onEdit(promotion.id)}
            >
              {t('promotions.edit')}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              onClick={() => onToggleActive(promotion)}
            >
              {promotion.status === 'ACTIVE' ? t('promotions.deactivate') : t('promotions.activate')}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
              onClick={() => onDelete(promotion.id)}
            >
              {t('promotions.delete')}
            </button>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
