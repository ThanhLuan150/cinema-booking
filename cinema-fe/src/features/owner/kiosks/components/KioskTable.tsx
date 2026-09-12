import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { Kiosk } from '@/types/entities';
import { KIOSK_STATUS_VARIANT } from '../constants';

interface KioskTableProps {
  kiosks: Kiosk[];
  isAllBranches: boolean;
  branchNameById: Map<number, string>;
  canManage: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (kiosk: Kiosk) => void;
  onRotateKey: (kiosk: Kiosk) => void;
  onDelete: (kiosk: Kiosk) => void;
}

function formatLastSeen(value: string | null, t: (key: string) => string) {
  return value ? new Date(value).toLocaleString() : t('kiosks.never');
}

export function KioskTable({
  kiosks,
  isAllBranches,
  branchNameById,
  canManage,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onRotateKey,
  onDelete,
}: KioskTableProps) {
  const { t } = useTranslation('owner');

  return (
    <>
      <DataTable
        headers={[
          t('kiosks.headers.kioskCode'),
          ...(isAllBranches ? [t('kiosks.headers.branch')] : []),
          t('kiosks.headers.name'),
          t('kiosks.headers.status'),
          t('kiosks.headers.lastSeen'),
          t('kiosks.headers.actions'),
        ]}
      >
        {kiosks.map((k) => (
          <tr key={k.id}>
            <td className="font-mono text-xs">{k.kiosk_code}</td>
            {isAllBranches && <td>{branchNameById.get(k.branch_id) || k.branch_id}</td>}
            <td>{k.name}</td>
            <td>
              <Badge variant={KIOSK_STATUS_VARIANT[k.status]}>{t(`kiosks.status.${k.status}`)}</Badge>
            </td>
            <td className="text-sm text-txt/70">{formatLastSeen(k.last_seen_at, t)}</td>
            <td className="flex flex-wrap gap-3">
              {canManage && (
                <>
                  <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => onEdit(k)}>
                    {t('kiosks.edit')}
                  </button>
                  <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => onRotateKey(k)}>
                    {t('kiosks.rotateKey')}
                  </button>
                  <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => onDelete(k)}>
                    {t('kiosks.delete')}
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
}
