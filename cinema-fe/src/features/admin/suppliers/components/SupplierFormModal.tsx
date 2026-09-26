import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Supplier, SupplierStatus } from '@/types/entities';
import { useCreateSupplier, useUpdateSupplier } from '../hooks/useSuppliers';

interface SupplierForm {
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  status: SupplierStatus;
}

const EMPTY_FORM: SupplierForm = {
  name: '',
  code: '',
  email: '',
  phone: '',
  address: '',
  status: 'ACTIVE',
};

const toForm = (supplier: Supplier): SupplierForm => ({
  name: supplier.name,
  code: supplier.code,
  email: supplier.email ?? '',
  phone: supplier.phone ?? '',
  address: supplier.address ?? '',
  status: supplier.status,
});

export function SupplierFormModal({
  editing,
  onClose,
}: {
  editing: Supplier | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const [form, setForm] = useState<SupplierForm>(editing ? toForm(editing) : EMPTY_FORM);
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();

  const set = <K extends keyof SupplierForm>(key: K, value: SupplierForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t('suppliers.validation.required'));
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form });
        toast.success(t('suppliers.updateSuccess'));
      } else {
        await createMutation.mutateAsync(form);
        toast.success(t('suppliers.createSuccess'));
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
      title={editing ? t('suppliers.editTitle', { name: editing.name }) : t('suppliers.addTitle')}
      className="max-w-lg"
    >
      <div className="space-y-3">
        <Input
          id="supplier-name"
          label={t('suppliers.fields.name')}
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <Input
          id="supplier-code"
          label={t('suppliers.fields.code')}
          value={form.code}
          onChange={(e) => set('code', e.target.value.toUpperCase())}
        />
        <Input
          id="supplier-email"
          type="email"
          label={t('suppliers.fields.email')}
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <Input
          id="supplier-phone"
          label={t('suppliers.fields.phone')}
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
        <Input
          id="supplier-address"
          label={t('suppliers.fields.address')}
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
        />
        <Select
          id="supplier-form-status"
          label={t('suppliers.fields.status')}
          value={form.status}
          onChange={(e) => set('status', e.target.value as SupplierStatus)}
          options={[
            { label: t('suppliers.status.ACTIVE'), value: 'ACTIVE' },
            { label: t('suppliers.status.INACTIVE'), value: 'INACTIVE' },
          ]}
        />
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="danger"
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={submit}
          >
            {t('suppliers.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
