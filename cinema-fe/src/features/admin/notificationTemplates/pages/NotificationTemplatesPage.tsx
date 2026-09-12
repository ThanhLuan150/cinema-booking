import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { NotificationTemplate } from '@/types/entities';
import type { NotificationTemplateFilters } from '../api/notificationTemplates.api';
import { useNotificationTemplates, useNotificationTemplateMeta } from '../hooks/useNotificationTemplates';
import { useDeleteNotificationTemplate } from '../hooks/useNotificationTemplateMutations';
import { FilterBar } from '../components/FilterBar';
import { ListItem } from '../components/ListItem';
import { TemplateFormModal } from '../components/TemplateFormModal';
import { emptyFilters } from '../constants';

function NotificationTemplatesPage() {
  const { t } = useTranslation('owner');
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('notificationTemplate.create');

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<NotificationTemplateFilters>(emptyFilters);

  const { data: meta } = useNotificationTemplateMeta();
  const { data: templatesPage, isLoading } = useNotificationTemplates(page, DEFAULT_PAGE_SIZE, filters);
  const templates = useMemo(() => templatesPage?.data ?? [], [templatesPage]);

  const deleteTemplate = useDeleteNotificationTemplate();

  const [modal, setModal] = useState<{ editing: NotificationTemplate | null } | null>(null);

  const supportedChannels = meta?.supportedChannels ?? ['EMAIL', 'IN_APP'];
  const events = meta?.events ?? [];
  const languages = meta?.languages ?? ['vi', 'en'];
  const statuses = meta?.statuses ?? ['ACTIVE', 'INACTIVE'];

  const patchFilter = (patch: Partial<NotificationTemplateFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const openCreate = useCallback(() => setModal({ editing: null }), []);
  const openEdit = useCallback((template: NotificationTemplate) => setModal({ editing: template }), []);

  const handleDelete = useCallback(
    async (template: NotificationTemplate) => {
      if (!(await confirmDialog(t('notificationTemplates.deleteConfirm')))) return;
      try {
        await deleteTemplate.mutateAsync(template.id);
        toast.success(t('notificationTemplates.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteTemplate, t],
  );

  return (
    <AdminLayout breadcrumb={t('notificationTemplates.breadcrumb')} loading={isLoading}>
      <FilterBar
        filters={filters}
        onFilterChange={patchFilter}
        onReset={() => {
          setFilters(emptyFilters);
          setPage(1);
        }}
        events={events}
        supportedChannels={supportedChannels}
        languages={languages}
        statuses={statuses}
        canManage={canManage}
        onAddClick={openCreate}
      />

      <DataTable
        headers={[
          t('notificationTemplates.headers.event'),
          t('notificationTemplates.headers.channel'),
          t('notificationTemplates.headers.language'),
          t('notificationTemplates.headers.subject'),
          t('notificationTemplates.headers.status'),
          t('notificationTemplates.headers.actions'),
        ]}
      >
        {templates.map((tmpl) => (
          <ListItem key={tmpl.id} template={tmpl} canManage={canManage} onEdit={openEdit} onDelete={handleDelete} />
        ))}
      </DataTable>

      {!isLoading && templates.length === 0 && (
        <p className="mt-4 text-sm text-txt/60">{t('notificationTemplates.empty')}</p>
      )}

      <Pagination page={page} totalPages={templatesPage?.totalPages ?? 1} onPageChange={setPage} />

      {modal && <TemplateFormModal editing={modal.editing} onClose={() => setModal(null)} />}
    </AdminLayout>
  );
}

export default NotificationTemplatesPage;
