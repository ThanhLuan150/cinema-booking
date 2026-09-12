import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { Campaign } from '@/types/entities';
import { STATE_VARIANT } from '../constants';
import { evaluateCampaign } from '../utils/campaignWindow';

interface CampaignsTableProps {
  campaigns: Campaign[];
  showAllBranchColumn: boolean;
  branchNameById: Map<number, string>;
  canManage: boolean;
  canNotify: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (campaign: Campaign) => void;
  onBanners: (campaign: Campaign) => void;
  onNotify: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
}

export function CampaignsTable({
  campaigns,
  showAllBranchColumn,
  branchNameById,
  canManage,
  canNotify,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onBanners,
  onNotify,
  onDelete,
}: CampaignsTableProps) {
  const { t } = useTranslation('owner');

  return (
    <>
      <DataTable
        headers={[
          t('campaigns.headers.name'),
          ...(showAllBranchColumn ? [t('campaigns.headers.scope')] : []),
          t('campaigns.headers.window'),
          t('campaigns.headers.target'),
          t('campaigns.headers.state'),
          t('campaigns.headers.notification'),
          t('campaigns.headers.actions'),
        ]}
      >
        {campaigns.map((c) => {
          const state = c.display_state ?? evaluateCampaign(c).state;
          return (
            <tr key={c.id}>
              <td>
                <div className="font-medium">{c.name}</div>
                {c.description && <div className="text-xs text-txt/60 line-clamp-1">{c.description}</div>}
              </td>
              {showAllBranchColumn && (
                <td>{c.branch_id === null ? t('campaigns.globalScope') : branchNameById.get(c.branch_id) || c.branch_id}</td>
              )}
              <td className="text-sm">
                {new Date(c.start_at).toLocaleDateString()} → {new Date(c.end_at).toLocaleDateString()}
              </td>
              <td>{t(`campaigns.target.${c.target_type}`)}</td>
              <td>
                <Badge variant={STATE_VARIANT[state]}>{t(`campaigns.state.${state}`)}</Badge>
              </td>
              <td className="text-sm">
                {c.notification_enabled ? (
                  <span title={c.notification_title}>
                    {c.notification_sent_count > 0
                      ? t('campaigns.notifSent', { count: c.notification_sent_count })
                      : t('campaigns.notifReady')}
                  </span>
                ) : (
                  <span className="text-txt/40">—</span>
                )}
              </td>
              <td className="flex flex-wrap gap-3">
                {canManage && (
                  <>
                    <button
                      type="button"
                      className="text-sm font-medium text-accent hover:text-accent-hover"
                      onClick={() => onEdit(c)}
                    >
                      {t('campaigns.edit')}
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-accent hover:text-accent-hover"
                      onClick={() => onBanners(c)}
                    >
                      {t('campaigns.banners')}
                    </button>
                  </>
                )}
                {canNotify && c.notification_enabled && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-40"
                    disabled={!evaluateCampaign(c).visible}
                    title={evaluateCampaign(c).visible ? undefined : t('campaigns.notifyOnlyRunning')}
                    onClick={() => onNotify(c)}
                  >
                    {t('campaigns.sendNotification')}
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 hover:text-red-400"
                    onClick={() => onDelete(c)}
                  >
                    {t('campaigns.delete')}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
}
