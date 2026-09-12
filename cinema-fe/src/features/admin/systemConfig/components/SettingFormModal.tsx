import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { RefundPolicyTier, SystemSettingEffective } from '@/types/entities';
import { useUpdateSystemConfig } from '../hooks/useSystemConfigMutations';
import { RefundTierEditor } from './RefundTierEditor';

export interface SettingFormModalProps {
  setting: SystemSettingEffective;
  isGlobalView: boolean;
  selectedBranchId: string;
  onClose: () => void;
}

export function SettingFormModal({ setting, isGlobalView, selectedBranchId, onClose }: SettingFormModalProps) {
  const { t } = useTranslation('owner');
  const updateSetting = useUpdateSystemConfig();

  const [formValue, setFormValue] = useState<string>(setting.type === 'JSON' ? '' : String(setting.value));
  const [formTiers, setFormTiers] = useState<RefundPolicyTier[]>(
    setting.type === 'JSON' && Array.isArray(setting.value) ? (setting.value as RefundPolicyTier[]) : [],
  );

  const submit = async () => {
    const branchId = isGlobalView ? null : Number(selectedBranchId);
    let value: unknown = formValue;
    if (setting.type === 'NUMBER') value = Number(formValue);
    else if (setting.type === 'BOOLEAN') value = formValue === 'true';
    else if (setting.type === 'JSON') value = formTiers;

    try {
      await updateSetting.mutateAsync({ key: setting.key, value, branchId });
      toast.success(t('systemConfig.updateSuccess'));
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={t('systemConfig.editTitle', { label: setting.label })} className="max-w-lg">
      <div className="space-y-3">
        <p className="text-sm text-txt/60">{setting.description}</p>

        {setting.type === 'NUMBER' && (
          <Input
            id="system-config-value"
            type="number"
            label={`${t('systemConfig.form.value')}${setting.unit ? ` (${setting.unit})` : ''}`}
            min={setting.min ?? undefined}
            max={setting.max ?? undefined}
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
          />
        )}

        {setting.type === 'STRING' && setting.allowedValues && (
          <Select
            id="system-config-value"
            label={t('systemConfig.form.value')}
            value={formValue}
            options={setting.allowedValues.map((v) => ({ label: v, value: v }))}
            onChange={(e) => setFormValue(e.target.value)}
          />
        )}

        {setting.type === 'BOOLEAN' && (
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

        {setting.type === 'JSON' && <RefundTierEditor tiers={formTiers} onChange={setFormTiers} />}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="danger" loading={updateSetting.isPending} onClick={submit}>
            {t('systemConfig.form.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
