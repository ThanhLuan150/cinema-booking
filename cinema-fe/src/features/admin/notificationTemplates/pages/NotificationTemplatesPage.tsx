import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type {
  NotificationTemplate,
  NotificationTemplateChannel,
  NotificationTemplateEvent,
  NotificationTemplateStatus,
} from '@/types/entities';
import {
  previewNotificationTemplate,
  type NotificationTemplateFilters,
} from '../api/notificationTemplates.api';
import { useNotificationTemplates, useNotificationTemplateMeta } from '../hooks/useNotificationTemplates';
import {
  useCreateNotificationTemplate,
  useDeleteNotificationTemplate,
  useUpdateNotificationTemplate,
} from '../hooks/useNotificationTemplateMutations';

interface TemplateForm {
  event: NotificationTemplateEvent | '';
  channel: NotificationTemplateChannel | '';
  language: string;
  subject: string;
  content: string;
  status: NotificationTemplateStatus;
  description: string;
}

const emptyForm: TemplateForm = {
  event: '',
  channel: '',
  language: 'vi',
  subject: '',
  content: '',
  status: 'ACTIVE',
  description: '',
};

const emptyFilters: NotificationTemplateFilters = { event: '', channel: '', language: '', status: '' };

// Pulls the per-field messages out of a 400 TEMPLATE_INVALID body, else the generic message.
function templateError(error: unknown, fallback: string): string {
  const details = (error as { response?: { data?: { details?: Array<{ message?: string }> } } })?.response?.data
    ?.details;
  if (Array.isArray(details) && details.length) {
    return details.map((d) => d.message).filter(Boolean).join(' • ');
  }
  return fallback;
}

function NotificationTemplatesPage() {
  const { t } = useTranslation('owner');
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('notificationTemplate.create');

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<NotificationTemplateFilters>(emptyFilters);

  const { data: meta } = useNotificationTemplateMeta();
  const { data: templatesPage, isLoading } = useNotificationTemplates(page, DEFAULT_PAGE_SIZE, filters);
  const templates = useMemo(() => templatesPage?.data ?? [], [templatesPage]);

  const createTemplate = useCreateNotificationTemplate();
  const updateTemplate = useUpdateNotificationTemplate();
  const deleteTemplate = useDeleteNotificationTemplate();

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; template?: NotificationTemplate } | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [preview, setPreview] = useState<{ subject: string; content: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const supportedChannels = meta?.supportedChannels ?? ['EMAIL', 'IN_APP'];
  const events = meta?.events ?? [];
  const languages = meta?.languages ?? ['vi', 'en'];
  const statuses = meta?.statuses ?? ['ACTIVE', 'INACTIVE'];
  const allowedVariables = form.event ? meta?.variablesByEvent?.[form.event] ?? [] : [];

  const patchFilter = (patch: Partial<NotificationTemplateFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const openCreate = useCallback(() => {
    setForm(emptyForm);
    setPreview(null);
    setModal({ mode: 'create' });
  }, []);

  const openEdit = useCallback((template: NotificationTemplate) => {
    setForm({
      event: template.event,
      channel: template.channel,
      language: template.language,
      subject: template.subject,
      content: template.content,
      status: template.status,
      description: template.description,
    });
    setPreview(null);
    setModal({ mode: 'edit', template });
  }, []);

  const runPreview = useCallback(async () => {
    if (!form.content.trim()) return;
    setPreviewing(true);
    try {
      const result = await previewNotificationTemplate({ subject: form.subject, content: form.content });
      setPreview({ subject: result.subject, content: result.content });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    } finally {
      setPreviewing(false);
    }
  }, [form.subject, form.content, t]);

  const submit = useCallback(async () => {
    if (!form.event || !form.channel || !form.content.trim()) return;
    const payload = {
      event: form.event,
      channel: form.channel,
      subject: form.subject.trim(),
      content: form.content,
      language: form.language,
      status: form.status,
      description: form.description.trim(),
    };
    try {
      if (modal?.mode === 'create') {
        await createTemplate.mutateAsync(payload);
        toast.success(t('notificationTemplates.createSuccess'));
      } else if (modal?.template) {
        await updateTemplate.mutateAsync({ id: modal.template.id, ...payload });
        toast.success(t('notificationTemplates.updateSuccess'));
      }
      setModal(null);
    } catch (error) {
      toast.error(templateError(error, getApiErrorMessage(error, t)));
    }
  }, [form, modal, createTemplate, updateTemplate, t]);

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

  const eventLabel = (event: string) =>
    t(`notificationTemplates.events.${event}`, { defaultValue: event.replace(/_/g, ' ') });

  return (
    <AdminLayout breadcrumb={t('notificationTemplates.breadcrumb')} loading={isLoading}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <Select
            id="tmpl-filter-event"
            label={t('notificationTemplates.filters.event')}
            value={filters.event}
            onChange={(e) => patchFilter({ event: e.target.value as NotificationTemplateEvent | '' })}
            placeholder={t('notificationTemplates.filters.any')}
            options={events.map((ev) => ({ label: eventLabel(ev), value: ev }))}
          />
        </div>
        <div className="max-w-[12rem] flex-1">
          <Select
            id="tmpl-filter-channel"
            label={t('notificationTemplates.filters.channel')}
            value={filters.channel}
            onChange={(e) => patchFilter({ channel: e.target.value as NotificationTemplateChannel | '' })}
            placeholder={t('notificationTemplates.filters.any')}
            options={supportedChannels.map((c) => ({ label: c, value: c }))}
          />
        </div>
        <div className="max-w-[10rem] flex-1">
          <Select
            id="tmpl-filter-language"
            label={t('notificationTemplates.filters.language')}
            value={filters.language}
            onChange={(e) => patchFilter({ language: e.target.value })}
            placeholder={t('notificationTemplates.filters.any')}
            options={languages.map((l) => ({ label: l, value: l }))}
          />
        </div>
        <div className="max-w-[10rem] flex-1">
          <Select
            id="tmpl-filter-status"
            label={t('notificationTemplates.filters.status')}
            value={filters.status}
            onChange={(e) => patchFilter({ status: e.target.value as NotificationTemplateStatus | '' })}
            placeholder={t('notificationTemplates.filters.any')}
            options={statuses.map((s) => ({ label: t(`notificationTemplates.status.${s}`), value: s }))}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFilters(emptyFilters);
            setPage(1);
          }}
        >
          {t('notificationTemplates.filters.reset')}
        </Button>
        {canManage && (
          <Button type="button" variant="danger" onClick={openCreate}>
            {t('notificationTemplates.addButton')}
          </Button>
        )}
      </div>

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
          <tr key={tmpl.id}>
            <td className="text-sm font-medium">{eventLabel(tmpl.event)}</td>
            <td>
              <Badge variant="default">{tmpl.channel}</Badge>
            </td>
            <td className="text-sm uppercase">{tmpl.language}</td>
            <td className="max-w-xs truncate text-sm text-txt/70" title={tmpl.subject || tmpl.content}>
              {tmpl.subject || tmpl.content}
            </td>
            <td>
              <Badge variant={tmpl.status === 'ACTIVE' ? 'success' : 'default'}>
                {t(`notificationTemplates.status.${tmpl.status}`)}
              </Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              {canManage ? (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => openEdit(tmpl)}
                  >
                    {t('notificationTemplates.edit')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 hover:text-red-400"
                    onClick={() => handleDelete(tmpl)}
                  >
                    {t('notificationTemplates.delete')}
                  </button>
                </>
              ) : (
                <span className="text-sm text-txt/40">—</span>
              )}
            </td>
          </tr>
        ))}
      </DataTable>

      {!isLoading && templates.length === 0 && (
        <p className="mt-4 text-sm text-txt/60">{t('notificationTemplates.empty')}</p>
      )}

      <Pagination page={page} totalPages={templatesPage?.totalPages ?? 1} onPageChange={setPage} />

      {modal && (
        <Modal
          open
          onClose={() => setModal(null)}
          title={modal.mode === 'create' ? t('notificationTemplates.addTitle') : t('notificationTemplates.editTitle')}
          className="max-w-2xl"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select
                label={t('notificationTemplates.form.event')}
                value={form.event}
                placeholder={t('notificationTemplates.form.selectEvent')}
                options={events.map((ev) => ({ label: eventLabel(ev), value: ev }))}
                onChange={(e) => {
                  setForm((f) => ({ ...f, event: e.target.value as NotificationTemplateEvent }));
                  setPreview(null);
                }}
              />
              <Select
                label={t('notificationTemplates.form.channel')}
                value={form.channel}
                placeholder={t('notificationTemplates.form.selectChannel')}
                options={supportedChannels.map((c) => ({ label: c, value: c }))}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as NotificationTemplateChannel }))}
              />
              <Select
                label={t('notificationTemplates.form.language')}
                value={form.language}
                options={languages.map((l) => ({ label: l, value: l }))}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
              />
            </div>

            <Input
              id="tmpl-form-subject"
              label={t('notificationTemplates.form.subject')}
              value={form.subject}
              placeholder={form.channel === 'IN_APP' ? t('notificationTemplates.form.subjectOptional') : ''}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />

            <Textarea
              id="tmpl-form-content"
              label={t('notificationTemplates.form.content')}
              rows={6}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />

            {allowedVariables.length > 0 && (
              <p className="text-xs text-txt/60">
                <span className="font-semibold">{t('notificationTemplates.form.variablesHint')}</span>{' '}
                {allowedVariables.map((v) => `{{${v}}}`).join(', ')}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label={t('notificationTemplates.form.status')}
                value={form.status}
                options={statuses.map((s) => ({ label: t(`notificationTemplates.status.${s}`), value: s }))}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as NotificationTemplateStatus }))}
              />
              <Input
                id="tmpl-form-description"
                label={t('notificationTemplates.form.description')}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="outline" loading={previewing} disabled={!form.content.trim()} onClick={runPreview}>
                {t('notificationTemplates.form.preview')}
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={createTemplate.isPending || updateTemplate.isPending}
                disabled={!form.event || !form.channel || !form.content.trim()}
                onClick={submit}
              >
                {t('notificationTemplates.form.submit')}
              </Button>
            </div>

            {preview && (
              <div className="mt-2 rounded-lg border border-border bg-surface p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-txt/50">
                  {t('notificationTemplates.form.previewTitle')}
                </p>
                {preview.subject && <p className="text-sm font-medium">{preview.subject}</p>}
                <pre className="mt-1 whitespace-pre-wrap break-words text-sm text-txt/80">{preview.content}</pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

export default NotificationTemplatesPage;
