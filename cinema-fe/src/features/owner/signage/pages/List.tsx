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
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { useSchedules } from '@/features/admin/schedules/hooks/useSchedules';
import type {
  Screen,
  ScreenStatus,
  SignageContent,
  SignageContentStatus,
  SignageContentType,
  SignageSchedule,
} from '@/types/entities';
import { useScreens, useScreenPlayback } from '../hooks/useScreens';
import { useSignageContents } from '../hooks/useSignageContents';
import { useSignageSchedules } from '../hooks/useSignageSchedules';
import {
  useCreateContent,
  useCreateScreen,
  useCreateSignageSchedule,
  useDeleteContent,
  useDeleteScreen,
  useDeleteSignageSchedule,
  useRotateScreenKey,
  useUpdateContent,
  useUpdateScreen,
  useUpdateSignageSchedule,
} from '../hooks/useSignageMutations';

const ALL_BRANCHES = 'ALL';
const SCREEN_STATUSES: ScreenStatus[] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
const CONTENT_STATUSES: SignageContentStatus[] = ['ACTIVE', 'INACTIVE'];
const CONTENT_TYPES: SignageContentType[] = [
  'MOVIE_POSTER',
  'SHOWTIME',
  'COMING_SOON',
  'PROMOTION',
  'ADVERTISEMENT',
  'ANNOUNCEMENT',
];

const SCREEN_STATUS_VARIANT: Record<ScreenStatus, 'success' | 'default' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  MAINTENANCE: 'warning',
};

const MOVIE_TYPES: SignageContentType[] = ['MOVIE_POSTER', 'COMING_SOON'];

interface ScreenForm {
  name: string;
  location: string;
  device_id: string;
  status: ScreenStatus;
}
const emptyScreenForm: ScreenForm = { name: '', location: '', device_id: '', status: 'ACTIVE' };

interface ContentForm {
  type: SignageContentType;
  title: string;
  body: string;
  image_url: string;
  movie_id: string;
  schedule_id: string;
  promotion_id: string;
  status: SignageContentStatus;
}
const emptyContentForm: ContentForm = {
  type: 'ANNOUNCEMENT',
  title: '',
  body: '',
  image_url: '',
  movie_id: '',
  schedule_id: '',
  promotion_id: '',
  status: 'ACTIVE',
};

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SignageList() {
  const { t } = useTranslation('owner');
  const isAdmin = useAuthRole() === ROLES.admin;
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('signage.manage');

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

  const { data: screensPage, isLoading } = useScreens(
    branchParam,
    page,
    DEFAULT_PAGE_SIZE,
    { status: (statusFilter || undefined) as ScreenStatus | undefined },
    { enabled: listEnabled },
  );
  const screens = useMemo(() => screensPage?.data ?? [], [screensPage]);

  const { data: contentsPage } = useSignageContents(branchParam, 1, FULL_LIST_FETCH_LIMIT, undefined, {
    enabled: listEnabled,
  });
  const contents = useMemo(() => contentsPage?.data ?? [], [contentsPage]);
  const contentById = useMemo(() => new Map(contents.map((c) => [c.id, c])), [contents]);

  const createScreen = useCreateScreen();
  const updateScreen = useUpdateScreen();
  const rotateScreenKey = useRotateScreenKey();
  const deleteScreen = useDeleteScreen();
  const createContent = useCreateContent();
  const updateContent = useUpdateContent();
  const deleteContent = useDeleteContent();

  const [showContent, setShowContent] = useState(false);
  const [screenModal, setScreenModal] = useState<{ mode: 'create' | 'edit'; screen?: Screen } | null>(null);
  const [screenForm, setScreenForm] = useState<ScreenForm>(emptyScreenForm);
  const [contentModal, setContentModal] = useState<{ mode: 'create' | 'edit'; content?: SignageContent } | null>(null);
  const [contentForm, setContentForm] = useState<ContentForm>(emptyContentForm);
  const [playlistScreen, setPlaylistScreen] = useState<Screen | null>(null);
  const [previewScreen, setPreviewScreen] = useState<Screen | null>(null);
  const [revealedKey, setRevealedKey] = useState<{ name: string; api_key: string } | null>(null);

  // ---- Screen CRUD ------------------------------------------------------------
  const openCreateScreen = useCallback(() => {
    setScreenForm(emptyScreenForm);
    setScreenModal({ mode: 'create' });
  }, []);

  const openEditScreen = useCallback((screen: Screen) => {
    setScreenForm({ name: screen.name, location: screen.location, device_id: screen.device_id, status: screen.status });
    setScreenModal({ mode: 'edit', screen });
  }, []);

  const submitScreen = useCallback(async () => {
    try {
      if (screenModal?.mode === 'create') {
        if (!concreteBranchId) return;
        const created = await createScreen.mutateAsync({
          branch_id: concreteBranchId,
          name: screenForm.name.trim(),
          location: screenForm.location.trim(),
          device_id: screenForm.device_id.trim() || undefined,
          status: screenForm.status,
        });
        setRevealedKey({ name: created.name, api_key: created.api_key });
        toast.success(t('signage.screenCreateSuccess'));
      } else if (screenModal?.screen) {
        await updateScreen.mutateAsync({
          id: screenModal.screen.id,
          name: screenForm.name.trim(),
          location: screenForm.location.trim(),
          device_id: screenForm.device_id.trim(),
          status: screenForm.status,
        });
        toast.success(t('signage.screenUpdateSuccess'));
      }
      setScreenModal(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  }, [screenModal, screenForm, concreteBranchId, createScreen, updateScreen, t]);

  const handleRotateScreenKey = useCallback(
    async (screen: Screen) => {
      if (!(await confirmDialog(t('signage.screenRotateConfirm')))) return;
      try {
        const { api_key } = await rotateScreenKey.mutateAsync(screen.id);
        setRevealedKey({ name: screen.name, api_key });
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [rotateScreenKey, t],
  );

  const handleDeleteScreen = useCallback(
    async (screen: Screen) => {
      if (!(await confirmDialog(t('signage.screenDeleteConfirm')))) return;
      try {
        await deleteScreen.mutateAsync(screen.id);
        toast.success(t('signage.screenDeleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteScreen, t],
  );

  // ---- Content CRUD --------------------------------------------------------
  const openCreateContent = useCallback(() => {
    setContentForm(emptyContentForm);
    setContentModal({ mode: 'create' });
  }, []);

  const openEditContent = useCallback((content: SignageContent) => {
    setContentForm({
      type: content.type,
      title: content.title,
      body: content.body,
      image_url: content.image_url,
      movie_id: content.movie_id ? String(content.movie_id) : '',
      schedule_id: content.schedule_id ? String(content.schedule_id) : '',
      promotion_id: content.promotion_id ? String(content.promotion_id) : '',
      status: content.status,
    });
    setContentModal({ mode: 'edit', content });
  }, []);

  const submitContent = useCallback(async () => {
    try {
      const base = {
        type: contentForm.type,
        title: contentForm.title.trim(),
        body: contentForm.body.trim(),
        image_url: contentForm.image_url.trim(),
        movie_id: MOVIE_TYPES.includes(contentForm.type) && contentForm.movie_id ? Number(contentForm.movie_id) : null,
        schedule_id: contentForm.type === 'SHOWTIME' && contentForm.schedule_id ? Number(contentForm.schedule_id) : null,
        promotion_id:
          contentForm.type === 'PROMOTION' && contentForm.promotion_id ? Number(contentForm.promotion_id) : null,
        status: contentForm.status,
      };
      if (contentModal?.mode === 'create') {
        if (!concreteBranchId) return;
        await createContent.mutateAsync({ branch_id: concreteBranchId, ...base });
        toast.success(t('signage.contentCreateSuccess'));
      } else if (contentModal?.content) {
        await updateContent.mutateAsync({ id: contentModal.content.id, ...base });
        toast.success(t('signage.contentUpdateSuccess'));
      }
      setContentModal(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  }, [contentModal, contentForm, concreteBranchId, createContent, updateContent, t]);

  const handleDeleteContent = useCallback(
    async (content: SignageContent) => {
      if (!(await confirmDialog(t('signage.contentDeleteConfirm')))) return;
      try {
        await deleteContent.mutateAsync(content.id);
        toast.success(t('signage.contentDeleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteContent, t],
  );

  const statusOptions = SCREEN_STATUSES.map((s) => ({ label: t(`signage.screenStatus.${s}`), value: s }));

  const contentNeedsRef =
    (MOVIE_TYPES.includes(contentForm.type) && !contentForm.movie_id) ||
    (contentForm.type === 'SHOWTIME' && !contentForm.schedule_id) ||
    (contentForm.type === 'PROMOTION' && !contentForm.promotion_id);

  return (
    <AdminLayout breadcrumb={t('signage.breadcrumb')} loading={isLoading}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setPage(1);
            }}
            placeholder={t('signage.branchPlaceholder')}
            options={[
              ...(isAdmin ? [{ label: t('signage.allBranches'), value: ALL_BRANCHES }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
            ]}
          />
        </div>
        <div className="max-w-xs flex-1">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder={t('signage.statusFilterPlaceholder')}
            options={statusOptions}
          />
        </div>
        <Button type="button" variant="outline" onClick={() => setShowContent((v) => !v)}>
          {t('signage.contentLibrary')}
        </Button>
        {canManage && concreteBranchId && (
          <Button type="button" variant="danger" onClick={openCreateScreen}>
            {t('signage.addScreen')}
          </Button>
        )}
      </div>

      {showContent && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-txt/60">{t('signage.contentTitle')}</h3>
            {canManage && concreteBranchId && (
              <Button type="button" size="sm" variant="secondary" onClick={openCreateContent}>
                {t('signage.addContent')}
              </Button>
            )}
          </div>
          {contents.length === 0 ? (
            <p className="text-sm text-txt/60">{t('signage.noContent')}</p>
          ) : (
            <DataTable
              headers={[
                t('signage.contentHeaders.title'),
                t('signage.contentHeaders.type'),
                t('signage.contentHeaders.status'),
                t('signage.contentHeaders.actions'),
              ]}
            >
              {contents.map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td>
                  <td>{t(`signage.contentType.${c.type}`)}</td>
                  <td>
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : 'default'}>
                      {t(`signage.contentStatusLabel.${c.status}`)}
                    </Badge>
                  </td>
                  <td className="flex flex-wrap gap-3">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          className="text-sm font-medium text-accent hover:text-accent-hover"
                          onClick={() => openEditContent(c)}
                        >
                          {t('signage.edit')}
                        </button>
                        <button
                          type="button"
                          className="text-sm font-medium text-red-500 hover:text-red-400"
                          onClick={() => handleDeleteContent(c)}
                        >
                          {t('signage.delete')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      )}

      <DataTable
        headers={[
          t('signage.headers.name'),
          ...(isAllBranches ? [t('signage.headers.branch')] : []),
          t('signage.headers.location'),
          t('signage.headers.deviceId'),
          t('signage.headers.status'),
          t('signage.headers.actions'),
        ]}
      >
        {screens.map((s) => (
          <tr key={s.id}>
            <td>{s.name}</td>
            {isAllBranches && <td>{branchNameById.get(s.branch_id) || s.branch_id}</td>}
            <td>{s.location || '—'}</td>
            <td className="font-mono text-xs">{s.device_id || '—'}</td>
            <td>
              <Badge variant={SCREEN_STATUS_VARIANT[s.status]}>{t(`signage.screenStatus.${s.status}`)}</Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              <button
                type="button"
                className="text-sm font-medium text-accent hover:text-accent-hover"
                onClick={() => setPlaylistScreen(s)}
              >
                {t('signage.playlist')}
              </button>
              <button
                type="button"
                className="text-sm font-medium text-accent hover:text-accent-hover"
                onClick={() => setPreviewScreen(s)}
              >
                {t('signage.preview')}
              </button>
              {canManage && (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => openEditScreen(s)}
                  >
                    {t('signage.edit')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => handleRotateScreenKey(s)}
                  >
                    {t('signage.rotateKey')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 hover:text-red-400"
                    onClick={() => handleDeleteScreen(s)}
                  >
                    {t('signage.delete')}
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={screensPage?.totalPages ?? 1} onPageChange={setPage} />

      {screenModal && (
        <Modal
          open
          onClose={() => setScreenModal(null)}
          title={screenModal.mode === 'create' ? t('signage.addScreenTitle') : t('signage.editScreenTitle')}
        >
          <div className="space-y-3">
            <Input
              id="screen-name"
              label={t('signage.nameLabel')}
              value={screenForm.name}
              onChange={(e) => setScreenForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              id="screen-location"
              label={t('signage.locationLabel')}
              value={screenForm.location}
              onChange={(e) => setScreenForm((f) => ({ ...f, location: e.target.value }))}
            />
            <Input
              id="screen-device-id"
              label={t('signage.deviceIdLabel')}
              value={screenForm.device_id}
              onChange={(e) => setScreenForm((f) => ({ ...f, device_id: e.target.value }))}
            />
            <Select
              label={t('signage.statusLabel')}
              value={screenForm.status}
              options={SCREEN_STATUSES.map((s) => ({ label: t(`signage.screenStatus.${s}`), value: s }))}
              onChange={(e) => setScreenForm((f) => ({ ...f, status: e.target.value as ScreenStatus }))}
            />
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="danger"
                loading={createScreen.isPending || updateScreen.isPending}
                disabled={!screenForm.name.trim()}
                onClick={submitScreen}
              >
                {t('signage.submit')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {contentModal && (
        <ContentModal
          mode={contentModal.mode}
          form={contentForm}
          setForm={setContentForm}
          branchId={concreteBranchId ?? contentModal.content?.branch_id}
          needsRef={contentNeedsRef}
          saving={createContent.isPending || updateContent.isPending}
          onClose={() => setContentModal(null)}
          onSubmit={submitContent}
        />
      )}

      {playlistScreen && (
        <PlaylistModal
          screen={playlistScreen}
          branchContents={contents}
          onClose={() => setPlaylistScreen(null)}
          canManage={canManage}
        />
      )}

      {previewScreen && (
        <PreviewModal screen={previewScreen} contentById={contentById} onClose={() => setPreviewScreen(null)} />
      )}

      {revealedKey && (
        <Modal open onClose={() => setRevealedKey(null)} title={t('signage.keyTitle')}>
          <p className="text-sm text-txt/70">{t('signage.keyHint', { name: revealedKey.name })}</p>
          <code className="mt-3 block break-all rounded-lg border border-border bg-surface p-3 font-mono text-sm text-accent">
            {revealedKey.api_key}
          </code>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setRevealedKey(null)}>
              {t('signage.keyDone')}
            </Button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

// --------------------------------------------------------------------------
interface ContentModalProps {
  mode: 'create' | 'edit';
  form: ContentForm;
  setForm: React.Dispatch<React.SetStateAction<ContentForm>>;
  branchId: number | undefined;
  needsRef: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

function ContentModal({ mode, form, setForm, branchId, needsRef, saving, onClose, onSubmit }: ContentModalProps) {
  const { t } = useTranslation('owner');
  const wantsMovie = MOVIE_TYPES.includes(form.type);
  const wantsShowtime = form.type === 'SHOWTIME';
  const wantsPromotion = form.type === 'PROMOTION';

  const { data: moviesPage } = useMovies(undefined, { page: 1, limit: 200 }, { enabled: wantsMovie });
  const movies = moviesPage?.data ?? [];
  const { data: schedulesPage } = useSchedules({ branchId }, 1, 200, wantsShowtime && branchId !== undefined);
  const schedules = schedulesPage?.data ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? t('signage.addContentTitle') : t('signage.editContentTitle')}
      className="max-w-lg"
    >
      <div className="space-y-3">
        <Select
          label={t('signage.typeLabel')}
          value={form.type}
          options={CONTENT_TYPES.map((ct) => ({ label: t(`signage.contentType.${ct}`), value: ct }))}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SignageContentType }))}
        />
        <Input
          id="content-title"
          label={t('signage.contentTitleLabel')}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />

        {wantsMovie && (
          <Select
            label={t('signage.movieLabel')}
            value={form.movie_id}
            options={[
              { label: t('signage.selectPlaceholder'), value: '' },
              ...movies.map((m) => ({ label: m.name, value: String(m.id) })),
            ]}
            onChange={(e) => setForm((f) => ({ ...f, movie_id: e.target.value }))}
          />
        )}
        {wantsShowtime && (
          <Select
            label={t('signage.showtimeLabel')}
            value={form.schedule_id}
            options={[
              { label: t('signage.selectPlaceholder'), value: '' },
              ...schedules.map((s) => ({
                label: `#${s.id} · ${s.movie_date} ${s.time_begin}`,
                value: String(s.id),
              })),
            ]}
            onChange={(e) => setForm((f) => ({ ...f, schedule_id: e.target.value }))}
          />
        )}
        {wantsPromotion && (
          <Input
            id="content-promotion-id"
            label={t('signage.promotionIdLabel')}
            type="number"
            value={form.promotion_id}
            onChange={(e) => setForm((f) => ({ ...f, promotion_id: e.target.value }))}
          />
        )}

        <Input
          id="content-image"
          label={t('signage.imageUrlLabel')}
          value={form.image_url}
          onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="content-body" className="text-sm font-medium text-txt/90">
            {t('signage.bodyLabel')}
          </label>
          <textarea
            id="content-body"
            className="w-full rounded-lg border border-border-strong bg-surface-soft px-3 py-2.5 text-txt"
            rows={3}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
        </div>
        <Select
          label={t('signage.statusLabel')}
          value={form.status}
          options={CONTENT_STATUSES.map((s) => ({ label: t(`signage.contentStatusLabel.${s}`), value: s }))}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SignageContentStatus }))}
        />
        <div className="flex justify-end pt-2">
          <Button type="button" variant="danger" loading={saving} disabled={!form.title.trim() || needsRef} onClick={onSubmit}>
            {t('signage.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------------
interface PlaylistModalProps {
  screen: Screen;
  branchContents: SignageContent[];
  canManage: boolean;
  onClose: () => void;
}

interface EntryForm {
  content_id: string;
  start_at: string;
  end_at: string;
  priority: string;
  status: 'ACTIVE' | 'INACTIVE';
}
const emptyEntryForm: EntryForm = { content_id: '', start_at: '', end_at: '', priority: '0', status: 'ACTIVE' };

function PlaylistModal({ screen, branchContents, canManage, onClose }: PlaylistModalProps) {
  const { t } = useTranslation('owner');
  const [page, setPage] = useState(1);
  const { data } = useSignageSchedules(screen.id, page, DEFAULT_PAGE_SIZE);
  const entries = data?.data ?? [];
  const contentById = useMemo(() => new Map(branchContents.map((c) => [c.id, c])), [branchContents]);

  const createEntry = useCreateSignageSchedule();
  const updateEntry = useUpdateSignageSchedule();
  const deleteEntry = useDeleteSignageSchedule();

  const [form, setForm] = useState<EntryForm>(emptyEntryForm);
  const [editing, setEditing] = useState<SignageSchedule | null>(null);

  const resetForm = () => {
    setForm(emptyEntryForm);
    setEditing(null);
  };

  const startEdit = (entry: SignageSchedule) => {
    setEditing(entry);
    setForm({
      content_id: String(entry.content_id),
      start_at: toLocalInput(entry.start_at),
      end_at: toLocalInput(entry.end_at),
      priority: String(entry.priority),
      status: entry.status,
    });
  };

  const submit = async () => {
    try {
      const payload = {
        start_at: form.start_at ? new Date(form.start_at).toISOString() : undefined,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : undefined,
        priority: Number(form.priority) || 0,
        status: form.status,
      };
      if (editing) {
        await updateEntry.mutateAsync({ id: editing.id, ...payload });
        toast.success(t('signage.entryUpdateSuccess'));
      } else {
        await createEntry.mutateAsync({
          screen_id: screen.id,
          content_id: Number(form.content_id),
          ...payload,
        });
        toast.success(t('signage.entryCreateSuccess'));
      }
      resetForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleDelete = async (entry: SignageSchedule) => {
    if (!(await confirmDialog(t('signage.entryDeleteConfirm')))) return;
    try {
      await deleteEntry.mutateAsync(entry.id);
      toast.success(t('signage.entryDeleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const formValid = (editing || form.content_id) && form.start_at && form.end_at;

  return (
    <Modal open onClose={onClose} title={t('signage.playlistTitle', { name: screen.name })} className="max-w-3xl">
      {entries.length === 0 ? (
        <p className="text-sm text-txt/60">{t('signage.noEntries')}</p>
      ) : (
        <DataTable
          headers={[
            t('signage.entryHeaders.content'),
            t('signage.entryHeaders.window'),
            t('signage.entryHeaders.priority'),
            t('signage.entryHeaders.status'),
            t('signage.entryHeaders.actions'),
          ]}
        >
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{contentById.get(e.content_id)?.title || `#${e.content_id}`}</td>
              <td className="text-sm">
                {new Date(e.start_at).toLocaleString()} → {new Date(e.end_at).toLocaleString()}
              </td>
              <td>{e.priority}</td>
              <td>
                <Badge variant={e.status === 'ACTIVE' ? 'success' : 'default'}>
                  {t(`signage.contentStatusLabel.${e.status}`)}
                </Badge>
              </td>
              <td className="flex flex-wrap gap-3">
                {canManage && (
                  <>
                    <button
                      type="button"
                      className="text-sm font-medium text-accent hover:text-accent-hover"
                      onClick={() => startEdit(e)}
                    >
                      {t('signage.edit')}
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-red-500 hover:text-red-400"
                      onClick={() => handleDelete(e)}
                    >
                      {t('signage.delete')}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {canManage && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
          <h4 className="text-sm font-semibold text-txt/70">
            {editing ? t('signage.editEntryTitle') : t('signage.addEntryTitle')}
          </h4>
          {!editing && (
            <Select
              label={t('signage.entryContentLabel')}
              value={form.content_id}
              options={[
                { label: t('signage.selectPlaceholder'), value: '' },
                ...branchContents.map((c) => ({ label: `${c.title} (${t(`signage.contentType.${c.type}`)})`, value: String(c.id) })),
              ]}
              onChange={(e) => setForm((f) => ({ ...f, content_id: e.target.value }))}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="entry-start"
              type="datetime-local"
              label={t('signage.startLabel')}
              value={form.start_at}
              onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
            />
            <Input
              id="entry-end"
              type="datetime-local"
              label={t('signage.endLabel')}
              value={form.end_at}
              onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="entry-priority"
              type="number"
              label={t('signage.priorityLabel')}
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            />
            <Select
              label={t('signage.statusLabel')}
              value={form.status}
              options={CONTENT_STATUSES.map((s) => ({ label: t(`signage.contentStatusLabel.${s}`), value: s }))}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
            />
          </div>
          <div className="flex justify-end gap-3">
            {editing && (
              <Button type="button" variant="secondary" onClick={resetForm}>
                {t('signage.cancel')}
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              loading={createEntry.isPending || updateEntry.isPending}
              disabled={!formValid}
              onClick={submit}
            >
              {t('signage.submit')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// --------------------------------------------------------------------------
interface PreviewModalProps {
  screen: Screen;
  contentById: Map<number, SignageContent>;
  onClose: () => void;
}

const DROP_LABEL: Record<string, string> = {
  CONTENT_NOT_FOUND: 'signage.drop.CONTENT_NOT_FOUND',
  CONTENT_INACTIVE: 'signage.drop.CONTENT_INACTIVE',
  CONTENT_BRANCH_MISMATCH: 'signage.drop.CONTENT_BRANCH_MISMATCH',
  SHOWTIME_NOT_FOUND: 'signage.drop.SHOWTIME_NOT_FOUND',
  SHOWTIME_BRANCH_MISMATCH: 'signage.drop.SHOWTIME_BRANCH_MISMATCH',
  SHOWTIME_CANCELLED: 'signage.drop.SHOWTIME_CANCELLED',
};

function PreviewModal({ screen, contentById, onClose }: PreviewModalProps) {
  const { t } = useTranslation('owner');
  const { data, isLoading } = useScreenPlayback(screen.id);

  return (
    <Modal open onClose={onClose} title={t('signage.previewTitle', { name: screen.name })} className="max-w-2xl">
      {isLoading ? (
        <p className="text-sm text-txt/60">{t('signage.loading')}</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-txt/50">
            {t('signage.previewGeneratedAt', { time: data ? new Date(data.generated_at).toLocaleString() : '' })}
          </p>
          {!data || data.items.length === 0 ? (
            <p className="text-sm text-txt/60">{t('signage.previewEmpty')}</p>
          ) : (
            <ol className="space-y-2">
              {data.items.map((item) => (
                <li key={item.schedule_entry_id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="default">{t(`signage.contentType.${item.type}`)}</Badge>
                  </div>
                  {item.movie && <p className="text-sm text-txt/70">{item.movie.name}</p>}
                  {item.showtime && (
                    <p className="text-sm text-txt/70">
                      {item.showtime.movie_date} {item.showtime.time_begin}–{item.showtime.time_end}
                    </p>
                  )}
                  <p className="text-xs text-txt/40">{t('signage.priorityLabel')}: {item.priority}</p>
                </li>
              ))}
            </ol>
          )}
          {data && data.dropped.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-txt/70">{t('signage.droppedTitle')}</h4>
              <ul className="mt-2 space-y-1 text-sm text-txt/60">
                {data.dropped.map((d, i) => (
                  <li key={`${d.entry_id}-${i}`}>
                    {contentById.get(d.content_id)?.title || `#${d.content_id}`} — {t(DROP_LABEL[d.code] ?? d.code)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export default SignageList;
