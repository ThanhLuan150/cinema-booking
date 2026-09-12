import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type {
  NotificationTemplate,
  NotificationTemplateChannel,
  NotificationTemplateEvent,
  NotificationTemplateStatus,
} from '@/types/entities';
import { previewNotificationTemplate } from '../api/notificationTemplates.api';
import { useNotificationTemplateMeta } from '../hooks/useNotificationTemplates';
import { useCreateNotificationTemplate, useUpdateNotificationTemplate } from '../hooks/useNotificationTemplateMutations';
import { emptyForm, eventLabel } from '../constants';
import type { TemplateForm } from '../types/notificationTemplates.types';

function toForm(template: NotificationTemplate): TemplateForm {
  return {
    event: template.event,
    channel: template.channel,
    language: template.language,
    subject: template.subject,
    content: template.content,
    status: template.status,
    description: template.description,
  };
}

// Pulls the per-field messages out of a 400 TEMPLATE_INVALID body, else the generic message.
function templateError(error: unknown, fallback: string): string {
  const details = (error as { response?: { data?: { details?: Array<{ message?: string }> } } })?.response?.data
    ?.details;
  if (Array.isArray(details) && details.length) {
    return details.map((d) => d.message).filter(Boolean).join(' • ');
  }
  return fallback;
}

export function TemplateFormModal({
  editing,
  onClose,
}: {
  editing: NotificationTemplate | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('owner');
  const { data: meta } = useNotificationTemplateMeta();

  const [form, setForm] = useState<TemplateForm>(editing ? toForm(editing) : emptyForm);
  const [preview, setPreview] = useState<{ subject: string; content: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const createTemplate = useCreateNotificationTemplate();
  const updateTemplate = useUpdateNotificationTemplate();

  const supportedChannels = meta?.supportedChannels ?? ['EMAIL', 'IN_APP'];
  const events = meta?.events ?? [];
  const languages = meta?.languages ?? ['vi', 'en'];
  const statuses = meta?.statuses ?? ['ACTIVE', 'INACTIVE'];
  const allowedVariables = form.event ? meta?.variablesByEvent?.[form.event] ?? [] : [];

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
      if (editing) {
        await updateTemplate.mutateAsync({ id: editing.id, ...payload });
        toast.success(t('notificationTemplates.updateSuccess'));
      } else {
        await createTemplate.mutateAsync(payload);
        toast.success(t('notificationTemplates.createSuccess'));
      }
      onClose();
    } catch (error) {
      toast.error(templateError(error, getApiErrorMessage(error, t)));
    }
  }, [form, editing, createTemplate, updateTemplate, onClose, t]);

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t('notificationTemplates.editTitle') : t('notificationTemplates.addTitle')}
      className="max-w-2xl"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label={t('notificationTemplates.form.event')}
            value={form.event}
            placeholder={t('notificationTemplates.form.selectEvent')}
            options={events.map((ev) => ({ label: eventLabel(t, ev), value: ev }))}
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
            options={languages.map((l) => ({ label: l.toUpperCase(), value: l }))}
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
  );
}
