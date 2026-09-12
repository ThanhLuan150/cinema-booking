import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { Screen, SignageContent, SignageSchedule } from '@/types/entities';
import { useSignageSchedules } from '../hooks/useSignageSchedules';
import { useCreateSignageSchedule, useDeleteSignageSchedule, useUpdateSignageSchedule } from '../hooks/useSignageMutations';
import { CONTENT_STATUSES, emptyEntryForm } from '../constants';
import type { EntryForm } from '../types/signage.types';

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface PlaylistModalProps {
  screen: Screen;
  branchContents: SignageContent[];
  canManage: boolean;
  onClose: () => void;
}

export function PlaylistModal({ screen, branchContents, canManage, onClose }: PlaylistModalProps) {
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
