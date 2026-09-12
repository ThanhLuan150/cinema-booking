import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { GiftCard } from '@/types/entities';
import { giftCardStatusVariant } from '../constants';

interface GiftCardTableProps {
  giftCards: GiftCard[];
  cinemaNameById: Map<number | null, string>;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onViewHistory: (id: number) => void;
  onBlock: (id: number) => void;
}

export function GiftCardTable({
  giftCards,
  cinemaNameById,
  page,
  totalPages,
  onPageChange,
  onViewHistory,
  onBlock,
}: GiftCardTableProps) {
  const { t } = useTranslation('owner');

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('giftCards.headers.id'),
          t('giftCards.headers.cinema'),
          t('giftCards.headers.code'),
          t('giftCards.headers.balance'),
          t('giftCards.headers.owner'),
          t('giftCards.headers.status'),
          t('giftCards.headers.actions'),
        ]}
      >
        {giftCards.map((card) => (
          <tr key={card.id}>
            <td>{card.id}</td>
            <td>{card.cinema_id ? cinemaNameById.get(card.cinema_id) || card.cinema_id : t('giftCards.systemWide')}</td>
            <td>{card.code}</td>
            <td>
              {card.remaining_balance.toLocaleString()}đ / {card.initial_balance.toLocaleString()}đ
            </td>
            <td>{card.owner_account_id ? `#${card.owner_account_id}` : t('giftCards.unclaimed')}</td>
            <td>
              <Badge variant={giftCardStatusVariant(card.status)}>{t(`giftCards.status.${card.status}`)}</Badge>
            </td>
            <td className="flex gap-3">
              <button
                type="button"
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                onClick={() => onViewHistory(card.id)}
              >
                {t('giftCards.viewHistory')}
              </button>
              {card.status !== 'BLOCKED' && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => onBlock(card.id)}
                >
                  {t('giftCards.block')}
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
