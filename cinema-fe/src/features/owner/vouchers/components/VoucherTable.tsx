import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { DISCOUNT_TYPE } from '@/constants/discountType';
import type { Cinema, Combo, Voucher } from '@/types/entities';

interface VoucherTableProps {
  vouchers: Voucher[];
  cinemas: Cinema[];
  combos: Combo[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onViewHistory: (voucherId: number) => void;
  onToggleActive: (voucher: Voucher) => void;
  onDelete: (voucherId: number) => void;
}

export function VoucherTable({
  vouchers,
  cinemas,
  combos,
  page,
  totalPages,
  onPageChange,
  onViewHistory,
  onToggleActive,
  onDelete,
}: VoucherTableProps) {
  const { t } = useTranslation('owner');

  const cinemaNameById = useMemo(() => new Map<number | null, string>(cinemas.map((c) => [c.id, c.name])), [cinemas]);
  const comboNameById = useMemo(() => new Map(combos.map((c) => [c.id, c.name])), [combos]);

  const describeDiscount = useCallback(
    (voucher: Voucher) => {
      switch (voucher.discount_type) {
        case DISCOUNT_TYPE.PERCENTAGE:
          return `${voucher.discount_value}%`;
        case DISCOUNT_TYPE.FIXED_AMOUNT:
          return `${voucher.discount_value.toLocaleString()}đ`;
        case DISCOUNT_TYPE.FREE_TICKET:
          return t('vouchers.freeTicketSummary', { count: voucher.free_quantity ?? 1 });
        case DISCOUNT_TYPE.FREE_COMBO:
          return t('vouchers.freeComboSummary', {
            count: voucher.free_quantity ?? 1,
            combo: voucher.combo_id ? comboNameById.get(voucher.combo_id) ?? `#${voucher.combo_id}` : t('vouchers.anyCombo'),
          });
        default:
          return '-';
      }
    },
    [comboNameById, t],
  );

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('vouchers.headers.id'),
          t('vouchers.headers.cinema'),
          t('vouchers.headers.code'),
          t('vouchers.headers.discount'),
          t('vouchers.headers.used'),
          t('vouchers.headers.status'),
          t('vouchers.headers.actions'),
        ]}
      >
        {vouchers.map((voucher) => (
          <tr key={voucher.id}>
            <td>{voucher.id}</td>
            <td>{cinemaNameById.get(voucher.cinema_id) || voucher.cinema_id}</td>
            <td>{voucher.code}</td>
            <td>{describeDiscount(voucher)}</td>
            <td>
              {voucher.used_count}
              {voucher.max_uses !== null ? `/${voucher.max_uses}` : ''}
            </td>
            <td>
              <Badge variant={voucher.active ? 'success' : 'default'}>
                {voucher.active ? t('vouchers.statusActive') : t('vouchers.statusInactive')}
              </Badge>
            </td>
            <td className="flex gap-3">
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                onClick={() => onViewHistory(voucher.id)}
              >
                {t('vouchers.viewHistory')}
              </button>
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                onClick={() => onToggleActive(voucher)}
              >
                {voucher.active ? t('vouchers.deactivate') : t('vouchers.activate')}
              </button>
              <button
                type="button"
                className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                onClick={() => onDelete(voucher.id)}
              >
                {t('vouchers.delete')}
              </button>
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
