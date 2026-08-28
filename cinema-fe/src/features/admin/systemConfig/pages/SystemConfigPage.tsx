import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { ROLES } from '@/constants/roles';
import type { RefundPolicyTier, SystemSettingEffective, SystemSettingSource } from '@/types/entities';
import { useSystemConfigList } from '../hooks/useSystemConfig';
import { useResetSystemConfig, useUpdateSystemConfig } from '../hooks/useSystemConfigMutations';

const GLOBAL = 'GLOBAL';

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

interface RefundTierEditorProps {
  tiers: RefundPolicyTier[];
  onChange: (tiers: RefundPolicyTier[]) => void;
}

function RefundTierEditor({ tiers, onChange }: RefundTierEditorProps) {
  const { t } = useTranslation('owner');
  const updateTier = (index: number, patch: Partial<RefundPolicyTier>) => {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  };
  const removeTier = (index: number) => onChange(tiers.filter((_, i) => i !== index));
  const addTier = () => onChange([...tiers, { minHours: 0, percent: 0 }]);

  return (
    <div className="space-y-2">
      {tiers.map((tier, index) => (
        <div key={index} className="flex items-end gap-2">
          <Input
            type="number"
            min={0}
            label={index === 0 ? t('systemConfig.form.minHours') : undefined}
            value={tier.minHours}
            onChange={(e) => updateTier(index, { minHours: Number(e.target.value) })}
          />
          <Input
            type="number"
            min={0}
            max={100}
            label={index === 0 ? t('systemConfig.form.percent') : undefined}
            value={tier.percent}
            onChange={(e) => updateTier(index, { percent: Number(e.target.value) })}
          />
          <Button type="button" variant="outline" onClick={() => removeTier(index)}>
            {t('systemConfig.form.removeTier')}
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addTier}>
        {t('systemConfig.form.addTier')}
      </Button>
    </div>
  );
}

function SystemConfigPage() {
  const { t } = useTranslation('owner');
  const isAdmin = useAuthRole() === ROLES.admin;
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('systemConfig.manage');

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  useEffect(() => {
    if (selectedBranchId) return;
    if (isAdmin) setSelectedBranchId(GLOBAL);
    else if (cinemas.length > 0) setSelectedBranchId(String(cinemas[0].id));
  }, [cinemas, selectedBranchId, isAdmin]);

  const isGlobalView = selectedBranchId === GLOBAL;
  const branchParam = isGlobalView || !selectedBranchId ? undefined : selectedBranchId;
  const currentLevelSource: SystemSettingSource = isGlobalView ? 'GLOBAL' : 'BRANCH';

  const { data, isLoading } = useSystemConfigList({ branchId: branchParam });
  const settings = data?.settings ?? [];

  const updateSetting = useUpdateSystemConfig();
  const resetSetting = useResetSystemConfig();

  const [modal, setModal] = useState<SystemSettingEffective | null>(null);
  const [formValue, setFormValue] = useState<string>('');
  const [formTiers, setFormTiers] = useState<RefundPolicyTier[]>([]);

  const openEdit = (setting: SystemSettingEffective) => {
    setModal(setting);
    if (setting.type === 'JSON') {
      setFormTiers(Array.isArray(setting.value) ? (setting.value as RefundPolicyTier[]) : []);
    } else {
      setFormValue(String(setting.value));
    }
  };

  const submit = async () => {
    if (!modal) return;
    const branchId = isGlobalView ? null : Number(selectedBranchId);
    let value: unknown = formValue;
    if (modal.type === 'NUMBER') value = Number(formValue);
    else if (modal.type === 'BOOLEAN') value = formValue === 'true';
    else if (modal.type === 'JSON') value = formTiers;

    try {
      await updateSetting.mutateAsync({ key: modal.key, value, branchId });
      toast.success(t('systemConfig.updateSuccess'));
      setModal(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleReset = async (setting: SystemSettingEffective) => {
    if (!(await confirmDialog(t('systemConfig.resetConfirm', { label: setting.label })))) return;
    try {
      await resetSetting.mutateAsync({ key: setting.key, branchId: isGlobalView ? undefined : selectedBranchId });
      toast.success(t('systemConfig.resetSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AdminLayout breadcrumb={t('systemConfig.breadcrumb')}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <Select
            id="system-config-branch"
            label={t('systemConfig.filters.branch')}
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            options={[
              ...(isAdmin ? [{ label: t('systemConfig.filters.globalSettings'), value: GLOBAL }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
            ]}
          />
        </div>
        {!isGlobalView && (
          <p className="max-w-md text-xs text-txt/60">{t('systemConfig.branchViewHint')}</p>
        )}
      </div>

      <DataTable
        headers={[
          t('systemConfig.headers.setting'),
          t('systemConfig.headers.value'),
          t('systemConfig.headers.source'),
          t('systemConfig.headers.actions'),
        ]}
      >
        {settings.map((setting) => {
          const disabledHere = !isGlobalView && !setting.branchOverridable;
          return (
            <tr key={setting.key}>
              <td className="max-w-sm">
                <p className="text-sm font-medium">{setting.label}</p>
                <p className="text-xs text-txt/60">{setting.description}</p>
              </td>
              <td className="text-sm">{formatValue(setting, t)}</td>
              <td>
                {disabledHere ? (
                  <Badge variant="outline">{t('systemConfig.globalOnly')}</Badge>
                ) : (
                  <Badge variant={sourceBadgeVariant(setting.source)}>
                    {t(`systemConfig.source.${setting.source}`)}
                  </Badge>
                )}
              </td>
              <td className="flex flex-wrap gap-3">
                {canManage && !disabledHere ? (
                  <>
                    <button
                      type="button"
                      className="text-sm font-medium text-accent hover:text-accent-hover"
                      onClick={() => openEdit(setting)}
                    >
                      {t('systemConfig.edit')}
                    </button>
                    {setting.source === currentLevelSource && (
                      <button
                        type="button"
                        className="text-sm font-medium text-red-500 hover:text-red-400"
                        onClick={() => handleReset(setting)}
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
        })}
      </DataTable>

      {!isLoading && settings.length === 0 && <p className="mt-4 text-sm text-txt/60">{t('systemConfig.empty')}</p>}

      {modal && (
        <Modal
          open
          onClose={() => setModal(null)}
          title={t('systemConfig.editTitle', { label: modal.label })}
          className="max-w-lg"
        >
          <div className="space-y-3">
            <p className="text-sm text-txt/60">{modal.description}</p>

            {modal.type === 'NUMBER' && (
              <Input
                id="system-config-value"
                type="number"
                label={`${t('systemConfig.form.value')}${modal.unit ? ` (${modal.unit})` : ''}`}
                min={modal.min ?? undefined}
                max={modal.max ?? undefined}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
            )}

            {modal.type === 'STRING' && modal.allowedValues && (
              <Select
                id="system-config-value"
                label={t('systemConfig.form.value')}
                value={formValue}
                options={modal.allowedValues.map((v) => ({ label: v, value: v }))}
                onChange={(e) => setFormValue(e.target.value)}
              />
            )}

            {modal.type === 'BOOLEAN' && (
              <Select
                id="system-config-value"
                label={t('systemConfig.form.value')}
                value={formValue}
                options={[
                  { label: t('systemConfig.yes'), value: 'true' },
                  { label: t('systemConfig.no'), value: 'false' },
                ]}
                onChange={(e) => setFormValue(e.target.value)}
              />
            )}

            {modal.type === 'JSON' && <RefundTierEditor tiers={formTiers} onChange={setFormTiers} />}

            <div className="flex justify-end pt-2">
              <Button type="button" variant="danger" loading={updateSetting.isPending} onClick={submit}>
                {t('systemConfig.form.submit')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

export default SystemConfigPage;
