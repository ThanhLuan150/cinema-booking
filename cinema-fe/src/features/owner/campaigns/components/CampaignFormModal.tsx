import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { useOwnerPromotions } from '@/features/owner/hooks/useOwnerPromotions';
import type { CampaignStatus, CampaignTargetType } from '@/types/entities';
import { useCampaignMeta } from '../hooks/useCampaigns';
import { evaluateCampaign } from '../utils/campaignWindow';
import { STATUSES, TARGET_TYPES } from '../constants';
import type { CampaignForm } from '../types/campaigns.types';

interface CampaignFormModalProps {
  mode: 'create' | 'edit';
  form: CampaignForm;
  setForm: React.Dispatch<React.SetStateAction<CampaignForm>>;
  branchId: number | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function CampaignFormModal({ mode, form, setForm, branchId, saving, onClose, onSubmit }: CampaignFormModalProps) {
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
