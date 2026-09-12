import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { PrivateEvent } from '@/types/entities';
import { STATUS_VARIANT, formatDateOrDash } from '../constants';

interface PrivateEventTableProps {
  events: PrivateEvent[];
  isAllBranches: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onQuote: (ev: PrivateEvent) => void;
  onApprove: (ev: PrivateEvent) => void;
  onConfirm: (ev: PrivateEvent) => void;
  onComplete: (ev: PrivateEvent) => void;
  onReject: (ev: PrivateEvent) => void;
}

export function PrivateEventTable({
  events,
  isAllBranches,
  page,
  totalPages,
  onPageChange,
  onQuote,
  onApprove,
  onConfirm,
  onComplete,
  onReject,
}: PrivateEventTableProps) {
  const { t } = useTranslation('privateEvents');

  return (
    <>
      <DataTable
        headers={[
          t('admin.headers.id'),
          ...(isAllBranches ? [t('admin.headers.branch')] : []),
          t('admin.headers.title'),
          t('admin.headers.room'),
          t('admin.headers.window'),
          t('admin.headers.guests'),
          t('admin.headers.quote'),
          t('admin.headers.status'),
          t('admin.headers.actions'),
        ]}
      >
        {events.map((ev) => (
          <tr key={ev.id}>
            <td>#{ev.id}</td>
            {isAllBranches && <td>{ev.branch_id}</td>}
            <td>
              <div className="font-medium text-white">{ev.title || t('mine.untitled', { id: ev.id })}</div>
              <div className="text-xs text-txt/55">{ev.contact_name || ev.contact_phone || ev.contact_email || '—'}</div>
            </td>
            <td>#{ev.room_id}</td>
            <td className="text-sm text-txt/70">
              {formatDateOrDash(ev.start_at)}
              <br />
              {formatDateOrDash(ev.end_at)}
            </td>
            <td>{ev.guest_count}</td>
            <td>{ev.quoted_amount != null ? `${ev.quoted_amount.toLocaleString()}đ` : '—'}</td>
            <td>
              <Badge variant={STATUS_VARIANT[ev.status]}>{t(`status.${ev.status}`)}</Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              {ev.status === 'REQUESTED' && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-hover"
                  onClick={() => onQuote(ev)}
                >
                  {t('admin.quote')}
                </button>
              )}
              {ev.status === 'QUOTED' && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-hover"
                  onClick={() => onApprove(ev)}
                >
                  {t('admin.approve')}
                </button>
              )}
              {ev.status === 'PAID' && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-hover"
                  onClick={() => onConfirm(ev)}
                >
                  {t('admin.confirm')}
                </button>
              )}
              {ev.status === 'CONFIRMED' && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-hover"
                  onClick={() => onComplete(ev)}
                >
                  {t('admin.complete')}
                </button>
              )}
              {!['COMPLETED', 'CANCELLED'].includes(ev.status) && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 hover:text-red-400"
                  onClick={() => onReject(ev)}
                >
                  {t('admin.reject')}
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
}
