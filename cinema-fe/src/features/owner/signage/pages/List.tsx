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
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import type { Screen, ScreenStatus, SignageContent } from '@/types/entities';
import { useScreens } from '../hooks/useScreens';
import { useSignageContents } from '../hooks/useSignageContents';
import {
  useCreateContent,
  useCreateScreen,
  useDeleteContent,
  useDeleteScreen,
  useRotateScreenKey,
  useUpdateContent,
  useUpdateScreen,
} from '../hooks/useSignageMutations';
import { ALL_BRANCHES, MOVIE_TYPES, emptyContentForm, emptyScreenForm } from '../constants';
import type { ContentForm, ScreenForm } from '../types/signage.types';
import { ScreenFilterBar } from '../components/ScreenFilterBar';
import { ContentLibraryPanel } from '../components/ContentLibraryPanel';
import { ScreensTable } from '../components/ScreensTable';
import { ScreenFormModal } from '../components/ScreenFormModal';
import { ContentFormModal } from '../components/ContentFormModal';
import { PlaylistModal } from '../components/PlaylistModal';
import { PreviewModal } from '../components/PreviewModal';
import { RevealedKeyModal } from '../components/RevealedKeyModal';

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

  const handleBranchChange = useCallback((value: string) => {
    setSelectedBranchId(value);
    setPage(1);
  }, []);

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

  const contentNeedsRef =
    (MOVIE_TYPES.includes(contentForm.type) && !contentForm.movie_id) ||
    (contentForm.type === 'SHOWTIME' && !contentForm.schedule_id) ||
    (contentForm.type === 'PROMOTION' && !contentForm.promotion_id);

  return (
    <AdminLayout breadcrumb={t('signage.breadcrumb')} loading={isLoading}>
      <ScreenFilterBar
        isAdmin={isAdmin}
        cinemas={cinemas}
        selectedBranchId={selectedBranchId}
        onBranchChange={handleBranchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        canManage={canManage}
        concreteBranchId={concreteBranchId}
        onToggleContentLibrary={() => setShowContent((v) => !v)}
        onAddScreen={openCreateScreen}
      />

      {showContent && (
        <ContentLibraryPanel
          contents={contents}
          canManage={canManage}
          canAdd={Boolean(concreteBranchId)}
          onAdd={openCreateContent}
          onEdit={openEditContent}
          onDelete={handleDeleteContent}
        />
      )}

      <ScreensTable
        screens={screens}
        isAllBranches={isAllBranches}
        branchNameById={branchNameById}
        canManage={canManage}
        page={page}
        totalPages={screensPage?.totalPages ?? 1}
        onPageChange={setPage}
        onPlaylist={setPlaylistScreen}
        onPreview={setPreviewScreen}
        onEdit={openEditScreen}
        onRotateKey={handleRotateScreenKey}
        onDelete={handleDeleteScreen}
      />

      {screenModal && (
        <ScreenFormModal
          mode={screenModal.mode}
          form={screenForm}
          setForm={setScreenForm}
          saving={createScreen.isPending || updateScreen.isPending}
          onClose={() => setScreenModal(null)}
          onSubmit={submitScreen}
        />
      )}

      {contentModal && (
        <ContentFormModal
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

      {revealedKey && <RevealedKeyModal revealedKey={revealedKey} onClose={() => setRevealedKey(null)} />}
    </AdminLayout>
  );
}

export default SignageList;
