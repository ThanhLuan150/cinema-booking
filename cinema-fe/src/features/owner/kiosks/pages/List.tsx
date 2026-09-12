import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
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
import type { KioskForm } from '../../types/owner.types';
import { useKiosks } from '../hooks/useKiosks';
import { useCreateKiosk, useDeleteKiosk, useRotateKioskKey, useUpdateKiosk } from '../hooks/useKioskMutations';
import { ALL_BRANCHES, emptyKioskForm } from '../constants';
import { KioskFilters } from '../components/KioskFilters';
import { KioskTable } from '../components/KioskTable';
import { KioskFormModal } from '../components/KioskFormModal';
import { KioskKeyModal } from '../components/KioskKeyModal';

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
  const [form, setForm] = useState<KioskForm>(emptyKioskForm);
  const [revealedKey, setRevealedKey] = useState<{ kiosk_code: string; api_key: string } | null>(null);

  const canManage = hasPermission('kiosk.create');

  const openCreate = useCallback(() => {
    setForm(emptyKioskForm);
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

  return (
    <AdminLayout breadcrumb={t('kiosks.breadcrumb')} loading={isLoading}>
      <p className="mb-4 text-sm text-txt/60">{t('kiosks.intro')}</p>
      <KioskFilters
        isAdmin={isAdmin}
        cinemas={cinemas}
        selectedBranchId={selectedBranchId}
        onBranchChange={(branchId) => {
          setSelectedBranchId(branchId);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        canManage={canManage}
        concreteBranchId={concreteBranchId}
        onAddClick={openCreate}
      />

      <KioskTable
        kiosks={kiosks}
        isAllBranches={isAllBranches}
        branchNameById={branchNameById}
        canManage={canManage}
        page={page}
        totalPages={kiosksPage?.totalPages ?? 1}
        onPageChange={setPage}
        onEdit={openEdit}
        onRotateKey={handleRotateKey}
        onDelete={handleDelete}
      />

      {kioskModal && (
        <KioskFormModal
          mode={kioskModal.mode}
          kiosk={kioskModal.kiosk}
          form={form}
          onFormChange={setForm}
          isSubmitting={createKiosk.isPending || updateKiosk.isPending}
          onClose={() => setKioskModal(null)}
          onSubmit={submit}
        />
      )}

      {revealedKey && (
        <KioskKeyModal
          kioskCode={revealedKey.kiosk_code}
          apiKey={revealedKey.api_key}
          onClose={() => setRevealedKey(null)}
        />
      )}
    </AdminLayout>
  );
}

export default KiosksList;
