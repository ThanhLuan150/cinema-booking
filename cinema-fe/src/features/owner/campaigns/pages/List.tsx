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
import type { Campaign, CampaignDisplayState, CampaignStatus } from '@/types/entities';
import { useCampaigns } from '../hooks/useCampaigns';
import { useCreateCampaign, useDeleteCampaign, useNotifyCampaign, useUpdateCampaign } from '../hooks/useCampaignMutations';
import { ALL_BRANCHES, GLOBAL, emptyForm } from '../constants';
import type { CampaignForm } from '../types/campaigns.types';
import { CampaignFilterBar } from '../components/CampaignFilterBar';
import { CampaignsTable } from '../components/CampaignsTable';
import { CampaignFormModal } from '../components/CampaignFormModal';
import { BannersModal } from '../components/BannersModal';

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CampaignsList() {
  const { t } = useTranslation('owner');
  const isAdmin = useAuthRole() === ROLES.admin;
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('campaign.manage');
  const canNotify = hasPermission('campaign.notify');

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [scope, setScope] = useState('');

  const { data: currentUser } = useCurrentUser();
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  useEffect(() => {
    if (scope) return;
    if (isAdmin) setScope(ALL_BRANCHES);
    else if (currentUser?.cinema_id) setScope(String(currentUser.cinema_id));
    else if (cinemas.length > 0) setScope(String(cinemas[0].id));
  }, [cinemas, scope, isAdmin, currentUser]);

  const handleScopeChange = useCallback((value: string) => {
    setScope(value);
    setPage(1);
  }, []);

  // Translate the scope selector into the query the API expects.
  const listParams = useMemo(() => {
    const base = {
      page,
      limit: DEFAULT_PAGE_SIZE,
      status: (statusFilter || undefined) as CampaignStatus | undefined,
      state: (stateFilter || undefined) as CampaignDisplayState | undefined,
    };
    if (scope === ALL_BRANCHES || scope === '') return base;
    if (scope === GLOBAL) return { ...base, global: true };
    return { ...base, branchId: Number(scope) };
  }, [page, statusFilter, stateFilter, scope]);

  const { data: campaignsPage, isLoading } = useCampaigns(listParams, { enabled: Boolean(scope) });
  const campaigns = useMemo(() => campaignsPage?.data ?? [], [campaignsPage]);

  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const notifyCampaign = useNotifyCampaign();

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; campaign?: Campaign } | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [bannersFor, setBannersFor] = useState<Campaign | null>(null);

  // The branch a new campaign is filed under is fixed by the scope selector: a concrete branch,
  // or Global (SUPER_ADMIN only). "All branches" is a listing view, not a place to create in.
  const createBranchId = useMemo<number | null | undefined>(() => {
    if (scope === GLOBAL) return null;
    if (scope && scope !== ALL_BRANCHES) return Number(scope);
    return undefined;
  }, [scope]);

  const openCreate = useCallback(() => {
    setForm(emptyForm);
    setModal({ mode: 'create' });
  }, []);

  const openEdit = useCallback((campaign: Campaign) => {
    setForm({
      name: campaign.name,
      description: campaign.description,
      start_at: toLocalInput(campaign.start_at),
      end_at: toLocalInput(campaign.end_at),
      status: campaign.status,
      target_type: campaign.target_type,
      movie_ids: campaign.movie_ids ?? [],
      promotion_ids: campaign.promotion_ids ?? [],
      notification_enabled: campaign.notification_enabled,
      notification_title: campaign.notification_title,
      notification_body: campaign.notification_body,
    });
    setModal({ mode: 'edit', campaign });
  }, []);

  const submit = useCallback(async () => {
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        start_at: form.start_at ? new Date(form.start_at).toISOString() : undefined,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : undefined,
        status: form.status,
        target_type: form.target_type,
        movie_ids: form.movie_ids,
        promotion_ids: form.promotion_ids,
        notification_enabled: form.notification_enabled,
        notification_title: form.notification_title.trim(),
        notification_body: form.notification_body.trim(),
      };
      if (modal?.mode === 'create') {
        if (createBranchId === undefined) return;
        await createCampaign.mutateAsync({ ...payload, branch_id: createBranchId });
        toast.success(t('campaigns.createSuccess'));
      } else if (modal?.campaign) {
        await updateCampaign.mutateAsync({ id: modal.campaign.id, ...payload });
        toast.success(t('campaigns.updateSuccess'));
      }
      setModal(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  }, [modal, form, createBranchId, createCampaign, updateCampaign, t]);

  const handleDelete = useCallback(
    async (campaign: Campaign) => {
      if (!(await confirmDialog(t('campaigns.deleteConfirm')))) return;
      try {
        await deleteCampaign.mutateAsync(campaign.id);
        toast.success(t('campaigns.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteCampaign, t],
  );

  const handleNotify = useCallback(
    async (campaign: Campaign) => {
      if (!(await confirmDialog(t('campaigns.notifyConfirm')))) return;
      try {
        const res = await notifyCampaign.mutateAsync(campaign.id);
        toast.success(t('campaigns.notifyResult', { sent: res.sent, skipped: res.skipped, audience: res.audience }));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [notifyCampaign, t],
  );

  const showAllBranchColumn = scope === ALL_BRANCHES || scope === '';

  return (
    <AdminLayout breadcrumb={t('campaigns.breadcrumb')} loading={isLoading}>
      <CampaignFilterBar
        isAdmin={isAdmin}
        cinemas={cinemas}
        scope={scope}
        onScopeChange={handleScopeChange}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        canManage={canManage}
        createBranchId={createBranchId}
        onAdd={openCreate}
      />

      <CampaignsTable
        campaigns={campaigns}
        showAllBranchColumn={showAllBranchColumn}
        branchNameById={branchNameById}
        canManage={canManage}
        canNotify={canNotify}
        page={page}
        totalPages={campaignsPage?.totalPages ?? 1}
        onPageChange={setPage}
        onEdit={openEdit}
        onBanners={setBannersFor}
        onNotify={handleNotify}
        onDelete={handleDelete}
      />

      {modal && (
        <CampaignFormModal
          mode={modal.mode}
          form={form}
          setForm={setForm}
          branchId={modal.campaign?.branch_id ?? createBranchId ?? null}
          saving={createCampaign.isPending || updateCampaign.isPending}
          onClose={() => setModal(null)}
          onSubmit={submit}
        />
      )}

      {bannersFor && <BannersModal campaign={bannersFor} canManage={canManage} onClose={() => setBannersFor(null)} />}
    </AdminLayout>
  );
}

export default CampaignsList;
