import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { Screen } from '@/types/entities';
import { SCREEN_STATUS_VARIANT } from '../constants';

interface ScreensTableProps {
  screens: Screen[];
  isAllBranches: boolean;
  branchNameById: Map<number, string>;
  canManage: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPlaylist: (screen: Screen) => void;
  onPreview: (screen: Screen) => void;
  onEdit: (screen: Screen) => void;
  onRotateKey: (screen: Screen) => void;
  onDelete: (screen: Screen) => void;
}

export function ScreensTable({
  screens,
  isAllBranches,
  branchNameById,
  canManage,
  page,
  totalPages,
  onPageChange,
  onPlaylist,
  onPreview,
  onEdit,
  onRotateKey,
  onDelete,
}: ScreensTableProps) {
  const { t } = useTranslation('owner');

  return (
    <>
      <DataTable
        headers={[
          t('signage.headers.name'),
          ...(isAllBranches ? [t('signage.headers.branch')] : []),
          t('signage.headers.location'),
          t('signage.headers.deviceId'),
          t('signage.headers.status'),
          t('signage.headers.actions'),
        ]}
      >
        {screens.map((s) => (
          <tr key={s.id}>
            <td>{s.name}</td>
            {isAllBranches && <td>{branchNameById.get(s.branch_id) || s.branch_id}</td>}
            <td>{s.location || '—'}</td>
            <td className="font-mono text-xs">{s.device_id || '—'}</td>
            <td>
              <Badge variant={SCREEN_STATUS_VARIANT[s.status]}>{t(`signage.screenStatus.${s.status}`)}</Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              <button
                type="button"
                className="text-sm font-medium text-accent hover:text-accent-hover"
                onClick={() => onPlaylist(s)}
              >
                {t('signage.playlist')}
              </button>
              <button
                type="button"
                className="text-sm font-medium text-accent hover:text-accent-hover"
                onClick={() => onPreview(s)}
              >
                {t('signage.preview')}
              </button>
              {canManage && (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => onEdit(s)}
                  >
                    {t('signage.edit')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => onRotateKey(s)}
                  >
                    {t('signage.rotateKey')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 hover:text-red-400"
                    onClick={() => onDelete(s)}
                  >
                    {t('signage.delete')}
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
