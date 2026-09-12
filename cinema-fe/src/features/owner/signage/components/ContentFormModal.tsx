import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { useSchedules } from '@/features/admin/schedules/hooks/useSchedules';
import type { SignageContentStatus, SignageContentType } from '@/types/entities';
import { CONTENT_STATUSES, CONTENT_TYPES, MOVIE_TYPES } from '../constants';
import type { ContentForm } from '../types/signage.types';

interface ContentFormModalProps {
  mode: 'create' | 'edit';
  form: ContentForm;
  setForm: React.Dispatch<React.SetStateAction<ContentForm>>;
  branchId: number | undefined;
  needsRef: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function ContentFormModal({ mode, form, setForm, branchId, needsRef, saving, onClose, onSubmit }: ContentFormModalProps) {
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
