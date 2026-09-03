import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import type { Kiosk, KioskStatus } from '@/types/entities';
import { useKiosks } from '../hooks/useKiosks';
import { useCreateKiosk, useDeleteKiosk, useRotateKioskKey, useUpdateKiosk } from '../hooks/useKioskMutations';

const ALL_BRANCHES = 'ALL';
const KIOSK_STATUSES: KioskStatus[] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

const KIOSK_STATUS_VARIANT: Record<KioskStatus, 'success' | 'default' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  MAINTENANCE: 'warning',
};

interface KioskForm {
  kiosk_code: string;
  name: string;
  status: KioskStatus;
}

const emptyForm: KioskForm = { kiosk_code: '', name: '', status: 'ACTIVE' };

function KiosksList() {
  const { t } = useTranslation('owner');
  const isAdmin = useAuthRole() === ROLES.admin;
  const { hasPermission } = usePermissions();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

  const { data: currentUser } = useCurrentUser();
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);
  const isAllBranches = selectedBranchId === ALL_BRANCHES;
  const concreteBranchId = !isAllBranches && selectedBranchId ? Number(selectedBranchId) : undefined;

  useEffect(() => {
    if (selectedBranchId) return;
    if (isAdmin) setSelectedBranchId(ALL_BRANCHES);
    else if (currentUser?.cinema_id) setSelectedBranchId(String(currentUser.cinema_id));
    else if (cinemas.length > 0) setSelectedBranchId(String(cinemas[0].id));
  }, [cinemas, selectedBranchId, isAdmin, currentUser]);

  const branchParam = isAllBranches ? undefined : selectedBranchId || undefined;
  const listEnabled = Boolean(selectedBranchId);

  const { data: kiosksPage, isLoading } = useKiosks(
    branchParam,
    page,
    DEFAULT_PAGE_SIZE,
    { status: (statusFilter || undefined) as KioskStatus | undefined },
    { enabled: listEnabled },
  );
  const kiosks = useMemo(() => kiosksPage?.data ?? [], [kiosksPage]);

  const createKiosk = useCreateKiosk();
  const updateKiosk = useUpdateKiosk();
  const rotateKey = useRotateKioskKey();
  const deleteKiosk = useDeleteKiosk();

  const [kioskModal, setKioskModal] = useState<{ mode: 'create' | 'edit'; kiosk?: Kiosk } | null>(null);
  const [form, setForm] = useState<KioskForm>(emptyForm);
  const [revealedKey, setRevealedKey] = useState<{ kiosk_code: string; api_key: string } | null>(null);

  const canManage = hasPermission('kiosk.create');

  const openCreate = useCallback(() => {
    setForm(emptyForm);
    setKioskModal({ mode: 'create' });
  }, []);

  const openEdit = useCallback((kiosk: Kiosk) => {
    setForm({ kiosk_code: kiosk.kiosk_code, name: kiosk.name, status: kiosk.status });
    setKioskModal({ mode: 'edit', kiosk });
  }, []);

  const submit = useCallback(async () => {
    try {
      if (kioskModal?.mode === 'create') {
        if (!concreteBranchId) return;
        const created = await createKiosk.mutateAsync({
          branch_id: concreteBranchId,
          kiosk_code: form.kiosk_code.trim(),
          name: form.name.trim(),
          status: form.status,
        });
        setRevealedKey({ kiosk_code: created.kiosk_code, api_key: created.api_key });
        toast.success(t('kiosks.createSuccess'));
      } else if (kioskModal?.kiosk) {
        await updateKiosk.mutateAsync({ id: kioskModal.kiosk.id, name: form.name.trim(), status: form.status });
        toast.success(t('kiosks.updateSuccess'));
      }
      setKioskModal(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  }, [kioskModal, form, concreteBranchId, createKiosk, updateKiosk, t]);

  const handleRotateKey = useCallback(
    async (kiosk: Kiosk) => {
      if (!(await confirmDialog(t('kiosks.rotateConfirm')))) return;
      try {
        const { api_key } = await rotateKey.mutateAsync(kiosk.id);
        setRevealedKey({ kiosk_code: kiosk.kiosk_code, api_key });
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [rotateKey, t],
  );

  const handleDelete = useCallback(
    async (kiosk: Kiosk) => {
      if (!(await confirmDialog(t('kiosks.deleteConfirm')))) return;
      try {
        await deleteKiosk.mutateAsync(kiosk.id);
        toast.success(t('kiosks.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteKiosk, t],
  );

  const statusOptions = KIOSK_STATUSES.map((s) => ({ label: t(`kiosks.status.${s}`), value: s }));
  const formatLastSeen = (value: string | null) => (value ? new Date(value).toLocaleString() : t('kiosks.never'));

  return (
    <AdminLayout breadcrumb={t('kiosks.breadcrumb')} loading={isLoading}>
      <p className="mb-4 text-sm text-txt/60">{t('kiosks.intro')}</p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setPage(1);
            }}
            placeholder={t('kiosks.branchPlaceholder')}
            options={[
              ...(isAdmin ? [{ label: t('kiosks.allBranches'), value: ALL_BRANCHES }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
            ]}
          />
        </div>
        <div className="max-w-xs flex-1">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder={t('kiosks.statusFilterPlaceholder')}
            options={statusOptions}
          />
        </div>
        {canManage && concreteBranchId && (
          <Button type="button" variant="danger" onClick={openCreate}>
            {t('kiosks.addButton')}
          </Button>
        )}
      </div>

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
            <td className="text-sm text-txt/70">{formatLastSeen(k.last_seen_at)}</td>
            <td className="flex flex-wrap gap-3">
              {canManage && (
                <>
                  <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => openEdit(k)}>
                    {t('kiosks.edit')}
                  </button>
                  <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => handleRotateKey(k)}>
                    {t('kiosks.rotateKey')}
                  </button>
                  <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => handleDelete(k)}>
                    {t('kiosks.delete')}
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={kiosksPage?.totalPages ?? 1} onPageChange={setPage} />

      {kioskModal && (
        <Modal
          open
          onClose={() => setKioskModal(null)}
          title={kioskModal.mode === 'create' ? t('kiosks.addTitle') : t('kiosks.editTitle')}
        >
          <div className="space-y-3">
            <Input
              id="kiosk-form-code"
              label={t('kiosks.kioskCodeLabel')}
              value={form.kiosk_code}
              disabled={kioskModal.mode === 'edit'}
              onChange={(e) => setForm((f) => ({ ...f, kiosk_code: e.target.value }))}
            />
            <Input
              id="kiosk-form-name"
              label={t('kiosks.nameLabel')}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              label={t('kiosks.statusLabel')}
              value={form.status}
              options={KIOSK_STATUSES.map((s) => ({ label: t(`kiosks.status.${s}`), value: s }))}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as KioskStatus }))}
            />
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="danger"
                loading={createKiosk.isPending || updateKiosk.isPending}
                disabled={!form.kiosk_code.trim() || !form.name.trim()}
                onClick={submit}
              >
                {t('kiosks.submit')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {revealedKey && (
        <Modal open onClose={() => setRevealedKey(null)} title={t('kiosks.keyTitle')}>
          <p className="text-sm text-txt/70">{t('kiosks.keyHint', { kioskCode: revealedKey.kiosk_code })}</p>
          <code className="mt-3 block break-all rounded-lg border border-border bg-surface p-3 font-mono text-sm text-accent">
            {revealedKey.api_key}
          </code>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setRevealedKey(null)}>
              {t('kiosks.keyDone')}
            </Button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

export default KiosksList;
