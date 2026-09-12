import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Integration, IntegrationType } from '@/types/entities';
import { INTEGRATION_TYPES, emptyIntegration } from '../constants';
import { useCreateIntegration, useUpdateIntegration } from '../hooks/useIntegrations';
import type { IntegrationForm } from '../types/integrations.types';

function toForm(integration: Integration): IntegrationForm {
  return {
    name: integration.name,
    provider: integration.provider,
    type: integration.type,
    status: integration.status,
    secret_env_var: integration.secret_env_var ?? '',
    description: integration.description ?? '',
  };
}

export function IntegrationFormModal({
  editing,
  onClose,
}: {
  editing: Integration | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const [form, setForm] = useState<IntegrationForm>(editing ? toForm(editing) : emptyIntegration);

  const createMut = useCreateIntegration();
  const updateMut = useUpdateIntegration();

  const submit = async () => {
    if (!form.name.trim() || !form.provider.trim()) {
      toast.error(t('integrations.validation.required'));
      return;
    }
    const payload = {
      name: form.name.trim(),
      provider: form.provider.trim(),
      type: form.type,
      status: form.status,
      secret_env_var: form.secret_env_var.trim() || null,
      description: form.description.trim(),
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload });
        toast.success(t('integrations.updateSuccess'));
      } else {
        await createMut.mutateAsync(payload);
        toast.success(t('integrations.createSuccess'));
      }
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t('integrations.editTitle', { name: editing.name }) : t('integrations.addTitle')}
      className="max-w-lg"
    >
      <div className="space-y-3">
        <Input
          id="integration-name"
          label={t('integrations.fields.name')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          id="integration-provider"
          label={t('integrations.fields.provider')}
          value={form.provider}
          disabled={Boolean(editing)}
          onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value.toUpperCase() }))}
          placeholder={t('integrations.fields.providerPlaceholder')}
        />
        <Select
          id="integration-type"
          label={t('integrations.fields.type')}
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as IntegrationType }))}
          options={INTEGRATION_TYPES.map((type) => ({ label: t(`integrations.types.${type}`), value: type }))}
        />
        <Input
          id="integration-secret-env-var"
          label={t('integrations.fields.secretEnvVar')}
          value={form.secret_env_var}
          onChange={(e) => setForm((f) => ({ ...f, secret_env_var: e.target.value }))}
          placeholder={t('integrations.fields.secretEnvVarPlaceholder')}
        />
        <p className="text-xs text-txt/60">{t('integrations.fields.secretEnvVarHint')}</p>
        <Textarea
          id="integration-description"
          label={t('integrations.fields.description')}
          value={form.description}
          rows={2}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <Select
          id="integration-form-status"
          label={t('integrations.fields.status')}
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
          options={[
            { label: t('integrations.status.ACTIVE'), value: 'ACTIVE' },
            { label: t('integrations.status.INACTIVE'), value: 'INACTIVE' },
          ]}
        />
        <div className="flex justify-end pt-2">
          <Button type="button" variant="danger" loading={createMut.isPending || updateMut.isPending} onClick={submit}>
            {t('integrations.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
