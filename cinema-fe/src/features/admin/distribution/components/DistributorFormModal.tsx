import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Distributor } from '@/types/entities';
import { useCreateDistributor, useUpdateDistributor } from '../hooks/useDistributors';
import { emptyDistributor } from '../constants';
import type { DistributorForm } from '../types/distribution.types';

function toForm(distributor: Distributor): DistributorForm {
  return {
    name: distributor.name,
    code: distributor.code,
    contact_email: distributor.contact_email ?? '',
    phone: distributor.phone ?? '',
    status: distributor.status,
  };
}

export function DistributorFormModal({
  editing,
  onClose,
}: {
  editing: Distributor | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const [form, setForm] = useState<DistributorForm>(editing ? toForm(editing) : emptyDistributor);

  const createMut = useCreateDistributor();
  const updateMut = useUpdateDistributor();

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t('distribution.distributors.validation.required'));
      return;
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...form });
        toast.success(t('distribution.distributors.updateSuccess'));
      } else {
        await createMut.mutateAsync(form);
        toast.success(t('distribution.distributors.createSuccess'));
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
      title={
        editing
          ? t('distribution.distributors.editTitle', { name: editing.name })
          : t('distribution.distributors.addTitle')
      }
      className="max-w-lg"
    >
      <div className="space-y-3">
        <Input
          id="distributor-name"
          label={t('distribution.distributors.fields.name')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          id="distributor-code"
          label={t('distribution.distributors.fields.code')}
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
        />
        <Input
          id="distributor-email"
          type="email"
          label={t('distribution.distributors.fields.email')}
          value={form.contact_email}
          onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
        />
        <Input
          id="distributor-phone"
          label={t('distribution.distributors.fields.phone')}
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <Select
          id="distributor-form-status"
          label={t('distribution.distributors.fields.status')}
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
          options={[
            { label: t('distribution.status.ACTIVE'), value: 'ACTIVE' },
            { label: t('distribution.status.INACTIVE'), value: 'INACTIVE' },
          ]}
        />
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="danger"
            loading={createMut.isPending || updateMut.isPending}
            onClick={submit}
          >
            {t('distribution.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
