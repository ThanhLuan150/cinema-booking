import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { useOwnerPromotions } from '@/features/owner/hooks/useOwnerPromotions';
import type {
  Campaign,
  CampaignBanner,
  CampaignBannerPlacement,
  CampaignDisplayState,
  CampaignStatus,
  CampaignTargetType,
} from '@/types/entities';
import { useCampaign, useCampaigns, useCampaignMeta } from '../hooks/useCampaigns';
import {
  useCreateCampaign,
  useCreateCampaignBanner,
  useDeleteCampaign,
  useDeleteCampaignBanner,
  useNotifyCampaign,
  useUpdateCampaign,
  useUpdateCampaignBanner,
} from '../hooks/useCampaignMutations';
import { evaluateCampaign } from '../utils/campaignWindow';

const ALL_BRANCHES = 'ALL';
const GLOBAL = 'GLOBAL';
const STATUSES: CampaignStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'];
const TARGET_TYPES: CampaignTargetType[] = ['ALL_CUSTOMERS', 'MEMBERS', 'BRANCH_CUSTOMERS'];
const STATES: CampaignDisplayState[] = ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'EXPIRED', 'ARCHIVED'];
const BANNER_PLACEMENTS: CampaignBannerPlacement[] = ['HOME_HERO', 'HOME_STRIP', 'MOVIE_DETAIL', 'BOOKING'];

const STATE_VARIANT: Record<CampaignDisplayState, 'success' | 'default' | 'warning' | 'outline'> = {
  RUNNING: 'success',
  SCHEDULED: 'warning',
  PAUSED: 'warning',
  DRAFT: 'default',
  EXPIRED: 'outline',
  ARCHIVED: 'default',
};

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CampaignForm {
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  status: CampaignStatus;
  target_type: CampaignTargetType;
  movie_ids: number[];
  promotion_ids: number[];
  notification_enabled: boolean;
  notification_title: string;
  notification_body: string;
}

const emptyForm: CampaignForm = {
  name: '',
  description: '',
  start_at: '',
  end_at: '',
  status: 'DRAFT',
  target_type: 'ALL_CUSTOMERS',
  movie_ids: [],
  promotion_ids: [],
  notification_enabled: false,
  notification_title: '',
  notification_body: '',
};

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

  const scopeOptions = [
    ...(isAdmin ? [{ label: t('campaigns.allBranches'), value: ALL_BRANCHES }] : []),
    ...(isAdmin ? [{ label: t('campaigns.globalScope'), value: GLOBAL }] : []),
    ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
  ];

  const showAllBranchColumn = scope === ALL_BRANCHES || scope === '';

  return (
    <AdminLayout breadcrumb={t('campaigns.breadcrumb')} loading={isLoading}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setPage(1);
            }}
            placeholder={t('campaigns.scopePlaceholder')}
            options={scopeOptions}
          />
        </div>
        <div className="max-w-[12rem] flex-1">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder={t('campaigns.statusFilterPlaceholder')}
            options={STATUSES.map((s) => ({ label: t(`campaigns.status.${s}`), value: s }))}
          />
        </div>
        <div className="max-w-[12rem] flex-1">
          <Select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            placeholder={t('campaigns.stateFilterPlaceholder')}
            options={STATES.map((s) => ({ label: t(`campaigns.state.${s}`), value: s }))}
          />
        </div>
        {canManage && createBranchId !== undefined && (
          <Button type="button" variant="danger" onClick={openCreate}>
            {t('campaigns.add')}
          </Button>
        )}
      </div>

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
                      onClick={() => openEdit(c)}
                    >
                      {t('campaigns.edit')}
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-accent hover:text-accent-hover"
                      onClick={() => setBannersFor(c)}
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
                    onClick={() => handleNotify(c)}
                  >
                    {t('campaigns.sendNotification')}
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 hover:text-red-400"
                    onClick={() => handleDelete(c)}
                  >
                    {t('campaigns.delete')}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={campaignsPage?.totalPages ?? 1} onPageChange={setPage} />

      {modal && (
        <CampaignModal
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

// --------------------------------------------------------------------------
interface CampaignModalProps {
  mode: 'create' | 'edit';
  form: CampaignForm;
  setForm: React.Dispatch<React.SetStateAction<CampaignForm>>;
  branchId: number | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

function CampaignModal({ mode, form, setForm, branchId, saving, onClose, onSubmit }: CampaignModalProps) {
  const { t } = useTranslation('owner');
  const { data: meta } = useCampaignMeta();
  const statuses = meta?.statuses ?? STATUSES;
  const targetTypes = meta?.targetTypes ?? TARGET_TYPES;

  const { data: moviesPage } = useMovies(undefined, { page: 1, limit: FULL_LIST_FETCH_LIMIT });
  const movies = moviesPage?.data ?? [];
  const { data: promotionsPage } = useOwnerPromotions(branchId ?? undefined, 1, FULL_LIST_FETCH_LIMIT);
  const promotions = promotionsPage?.data ?? [];

  const preview = evaluateCampaign(
    { status: form.status, start_at: form.start_at, end_at: form.end_at },
  );

  const toggleId = (key: 'movie_ids' | 'promotion_ids', id: number) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
    }));

  const windowValid = form.start_at && form.end_at && new Date(form.start_at) < new Date(form.end_at);
  const notifValid = !form.notification_enabled || form.notification_title.trim().length > 0;
  const canSave = form.name.trim() && windowValid && notifValid;

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? t('campaigns.addTitle') : t('campaigns.editTitle')}
      className="max-w-2xl"
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm">
          {branchId === null ? t('campaigns.globalHint') : t('campaigns.branchHint')}
          {' · '}
          {t('campaigns.previewState')}: <strong>{t(`campaigns.state.${preview.state}`)}</strong>
        </div>

        <Input
          id="campaign-name"
          label={t('campaigns.nameLabel')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Textarea
          id="campaign-description"
          label={t('campaigns.descriptionLabel')}
          rows={2}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            id="campaign-start"
            type="datetime-local"
            label={t('campaigns.startLabel')}
            value={form.start_at}
            onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
          />
          <Input
            id="campaign-end"
            type="datetime-local"
            label={t('campaigns.endLabel')}
            value={form.end_at}
            onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label={t('campaigns.statusLabel')}
            value={form.status}
            options={statuses.map((s) => ({ label: t(`campaigns.status.${s}`), value: s }))}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CampaignStatus }))}
          />
          <Select
            label={t('campaigns.targetLabel')}
            value={form.target_type}
            options={targetTypes.map((s) => ({ label: t(`campaigns.target.${s}`), value: s }))}
            onChange={(e) => setForm((f) => ({ ...f, target_type: e.target.value as CampaignTargetType }))}
          />
        </div>

        <CheckboxList
          label={t('campaigns.moviesLabel')}
          empty={t('campaigns.noMovies')}
          items={movies.map((m) => ({ id: m.id, label: m.name }))}
          selected={form.movie_ids}
          onToggle={(id) => toggleId('movie_ids', id)}
        />
        <CheckboxList
          label={t('campaigns.promotionsLabel')}
          empty={t('campaigns.noPromotions')}
          items={promotions.map((p) => ({ id: p.id, label: `${p.code} — ${p.name}` }))}
          selected={form.promotion_ids}
          onToggle={(id) => toggleId('promotion_ids', id)}
        />

        <div className="rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.notification_enabled}
              onChange={(e) => setForm((f) => ({ ...f, notification_enabled: e.target.checked }))}
            />
            {t('campaigns.notificationEnableLabel')}
          </label>
          {form.notification_enabled && (
            <div className="mt-3 space-y-3">
              <Input
                id="campaign-notif-title"
                label={t('campaigns.notificationTitleLabel')}
                value={form.notification_title}
                onChange={(e) => setForm((f) => ({ ...f, notification_title: e.target.value }))}
              />
              <Textarea
                id="campaign-notif-body"
                label={t('campaigns.notificationBodyLabel')}
                rows={2}
                value={form.notification_body}
                onChange={(e) => setForm((f) => ({ ...f, notification_body: e.target.value }))}
              />
              <p className="text-xs text-txt/60">{t('campaigns.notificationHint')}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="danger" loading={saving} disabled={!canSave} onClick={onSubmit}>
            {t('campaigns.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------------
interface CheckboxListProps {
  label: string;
  empty: string;
  items: { id: number; label: string }[];
  selected: number[];
  onToggle: (id: number) => void;
}

function CheckboxList({ label, empty, items, selected, onToggle }: CheckboxListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-txt/90">{label}</span>
      <div className="max-h-36 overflow-y-auto rounded-lg border border-border-strong bg-surface-soft p-2">
        {items.length === 0 ? (
          <p className="px-1 py-2 text-sm text-txt/50">{empty}</p>
        ) : (
          items.map((it) => (
            <label key={it.id} className="flex items-center gap-2 px-1 py-1 text-sm">
              <input type="checkbox" checked={selected.includes(it.id)} onChange={() => onToggle(it.id)} />
              {it.label}
            </label>
          ))
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
interface BannersModalProps {
  campaign: Campaign;
  canManage: boolean;
  onClose: () => void;
}

interface BannerForm {
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
  placement: CampaignBannerPlacement;
  sort_order: string;
  status: 'ACTIVE' | 'INACTIVE';
}
const emptyBannerForm: BannerForm = {
  title: '',
  subtitle: '',
  image_url: '',
  link_url: '',
  placement: 'HOME_STRIP',
  sort_order: '0',
  status: 'ACTIVE',
};

function BannersModal({ campaign, canManage, onClose }: BannersModalProps) {
  const { t } = useTranslation('owner');
  const { data: detail } = useCampaign(campaign.id);
  const banners = detail?.banners ?? [];

  const createBanner = useCreateCampaignBanner();
  const updateBanner = useUpdateCampaignBanner();
  const deleteBanner = useDeleteCampaignBanner();

  const [form, setForm] = useState<BannerForm>(emptyBannerForm);
  const [editing, setEditing] = useState<CampaignBanner | null>(null);

  const reset = () => {
    setForm(emptyBannerForm);
    setEditing(null);
  };

  const startEdit = (b: CampaignBanner) => {
    setEditing(b);
    setForm({
      title: b.title,
      subtitle: b.subtitle,
      image_url: b.image_url,
      link_url: b.link_url,
      placement: b.placement,
      sort_order: String(b.sort_order),
      status: b.status,
    });
  };

  const submit = async () => {
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        image_url: form.image_url.trim(),
        link_url: form.link_url.trim(),
        placement: form.placement,
        sort_order: Number(form.sort_order) || 0,
        status: form.status,
      };
      if (editing) {
        await updateBanner.mutateAsync({ bannerId: editing.id, ...payload });
        toast.success(t('campaigns.bannerUpdateSuccess'));
      } else {
        await createBanner.mutateAsync({ campaignId: campaign.id, ...payload });
        toast.success(t('campaigns.bannerCreateSuccess'));
      }
      reset();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleDelete = async (b: CampaignBanner) => {
    if (!(await confirmDialog(t('campaigns.bannerDeleteConfirm')))) return;
    try {
      await deleteBanner.mutateAsync(b.id);
      toast.success(t('campaigns.bannerDeleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const formValid = form.title.trim() && form.image_url.trim();

  return (
    <Modal open onClose={onClose} title={t('campaigns.bannersTitle', { name: campaign.name })} className="max-w-3xl">
      {banners.length === 0 ? (
        <p className="text-sm text-txt/60">{t('campaigns.noBanners')}</p>
      ) : (
        <DataTable
          headers={[
            t('campaigns.bannerHeaders.title'),
            t('campaigns.bannerHeaders.placement'),
            t('campaigns.bannerHeaders.order'),
            t('campaigns.bannerHeaders.status'),
            t('campaigns.bannerHeaders.actions'),
          ]}
        >
          {banners.map((b) => (
            <tr key={b.id}>
              <td className="flex items-center gap-2">
                {b.image_url && <img src={b.image_url} alt="" className="h-8 w-14 rounded object-cover" />}
                {b.title}
              </td>
              <td>{t(`campaigns.placement.${b.placement}`)}</td>
              <td>{b.sort_order}</td>
              <td>
                <Badge variant={b.status === 'ACTIVE' ? 'success' : 'default'}>
                  {t(`campaigns.bannerStatus.${b.status}`)}
                </Badge>
              </td>
              <td className="flex flex-wrap gap-3">
                {canManage && (
                  <>
                    <button
                      type="button"
                      className="text-sm font-medium text-accent hover:text-accent-hover"
                      onClick={() => startEdit(b)}
                    >
                      {t('campaigns.edit')}
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-red-500 hover:text-red-400"
                      onClick={() => handleDelete(b)}
                    >
                      {t('campaigns.delete')}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {canManage && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface p-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-txt/60">
            {editing ? t('campaigns.editBanner') : t('campaigns.addBanner')}
          </h4>
          <Input
            id="banner-title"
            label={t('campaigns.bannerTitleLabel')}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Input
            id="banner-subtitle"
            label={t('campaigns.bannerSubtitleLabel')}
            value={form.subtitle}
            onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          />
          <Input
            id="banner-image"
            label={t('campaigns.bannerImageLabel')}
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
          />
          <Input
            id="banner-link"
            label={t('campaigns.bannerLinkLabel')}
            value={form.link_url}
            onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label={t('campaigns.bannerPlacementLabel')}
              value={form.placement}
              options={BANNER_PLACEMENTS.map((p) => ({ label: t(`campaigns.placement.${p}`), value: p }))}
              onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value as CampaignBannerPlacement }))}
            />
            <Input
              id="banner-order"
              type="number"
              label={t('campaigns.bannerOrderLabel')}
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            />
            <Select
              label={t('campaigns.bannerStatusFieldLabel')}
              value={form.status}
              options={['ACTIVE', 'INACTIVE'].map((s) => ({ label: t(`campaigns.bannerStatus.${s}`), value: s }))}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            {editing && (
              <Button type="button" variant="secondary" onClick={reset}>
                {t('campaigns.cancel')}
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              loading={createBanner.isPending || updateBanner.isPending}
              disabled={!formValid}
              onClick={submit}
            >
              {t('campaigns.save')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default CampaignsList;
