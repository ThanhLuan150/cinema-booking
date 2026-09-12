import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import type { RefundPolicyTier, SystemSettingEffective, SystemSettingSource } from '@/types/entities';

function sourceBadgeVariant(source: SystemSettingSource): 'default' | 'accent' | 'outline' {
  if (source === 'BRANCH') return 'accent';
  if (source === 'GLOBAL') return 'default';
  return 'outline';
}

function formatValue(setting: SystemSettingEffective, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (setting.type === 'JSON') {
    const tiers = setting.value as RefundPolicyTier[];
    return t('systemConfig.tiersCount', { count: Array.isArray(tiers) ? tiers.length : 0 });
  }
  if (setting.type === 'BOOLEAN') {
    return setting.value ? t('systemConfig.yes') : t('systemConfig.no');
  }
  const unit = setting.unit ? ` ${setting.unit}` : '';
  return `${setting.value}${unit}`;
}

export interface ListItemProps {
  setting: SystemSettingEffective;
  canManage: boolean;
  isGlobalView: boolean;
  currentLevelSource: SystemSettingSource;
  onEdit: (setting: SystemSettingEffective) => void;
  onReset: (setting: SystemSettingEffective) => void;
}

export function ListItem({ setting, canManage, isGlobalView, currentLevelSource, onEdit, onReset }: ListItemProps) {
  const { t } = useTranslation('owner');
  const disabledHere = !isGlobalView && !setting.branchOverridable;

  return (
    <tr>
      <td className="max-w-sm">
        <p className="text-sm font-medium">{setting.label}</p>
        <p className="text-xs text-txt/60">{setting.description}</p>
      </td>
      <td className="text-sm">{formatValue(setting, t)}</td>
      <td>
        {disabledHere ? (
          <Badge variant="outline">{t('systemConfig.globalOnly')}</Badge>
        ) : (
          <Badge variant={sourceBadgeVariant(setting.source)}>{t(`systemConfig.source.${setting.source}`)}</Badge>
        )}
      </td>
      <td className="flex flex-wrap gap-3">
        {canManage && !disabledHere ? (
          <>
            <button
              type="button"
              className="text-sm font-medium text-accent hover:text-accent-hover"
              onClick={() => onEdit(setting)}
            >
              {t('systemConfig.edit')}
            </button>
            {setting.source === currentLevelSource && (
              <button
                type="button"
                className="text-sm font-medium text-red-500 hover:text-red-400"
                onClick={() => onReset(setting)}
              >
                {t('systemConfig.reset')}
              </button>
            )}
          </>
        ) : (
          <span className="text-sm text-txt/40">—</span>
        )}
      </td>
    </tr>
  );
}
