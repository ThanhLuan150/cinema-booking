import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyMovies } from '@/features/admin/movies/hooks/useMyMovies';
import type { MovieRelease } from '@/types/entities';
import { useAllDistributors } from '../hooks/useDistributors';
import { useCreateMovieRelease, useUpdateMovieRelease } from '../hooks/useMovieReleases';
import { emptyRelease } from '../constants';
import type { ReleaseForm } from '../types/distribution.types';

function toForm(release: MovieRelease): ReleaseForm {
  return {
    movie_id: String(release.movie_id),
    distributor_id: String(release.distributor_id),
    release_date: release.release_date,
    end_date: release.end_date ?? '',
    status: release.status,
  };
}

export function ReleaseFormModal({
  editing,
  onClose,
}: {
  editing: MovieRelease | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const [form, setForm] = useState<ReleaseForm>(editing ? toForm(editing) : emptyRelease);

  const { data: moviesPage } = useMyMovies(1, FULL_LIST_FETCH_LIMIT);
  const movies = useMemo(() => moviesPage?.data ?? [], [moviesPage]);
  const { data: distributors = [] } = useAllDistributors('ACTIVE');

  const createMut = useCreateMovieRelease();
  const updateMut = useUpdateMovieRelease();

  const dateOrderError =
    form.release_date && form.end_date && form.end_date < form.release_date
      ? t('distribution.releases.validation.endBeforeStart')
      : '';

  const submit = async () => {
    if (!form.movie_id || !form.distributor_id || !form.release_date) {
      toast.error(t('distribution.releases.validation.required'));
      return;
    }
    if (dateOrderError) {
      toast.error(dateOrderError);
      return;
    }
    const payload = {
      movie_id: Number(form.movie_id),
      distributor_id: Number(form.distributor_id),
      release_date: form.release_date,
      end_date: form.end_date || null,
      status: form.status,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload });
        toast.success(t('distribution.releases.updateSuccess'));
      } else {
        await createMut.mutateAsync(payload);
        toast.success(t('distribution.releases.createSuccess'));
      }
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t('distribution.releases.editTitle') : t('distribution.releases.addTitle')}
      className="max-w-lg"
    >
      <div className="space-y-3">
        <Select
          id="release-movie"
          label={t('distribution.releases.fields.movie')}
          value={form.movie_id}
          disabled={Boolean(editing)}
          onChange={(e) => setForm((f) => ({ ...f, movie_id: e.target.value }))}
          options={movies.map((m) => ({ label: m.name, value: String(m.id) }))}
          placeholder={t('distribution.releases.fields.moviePlaceholder')}
        />
        <Select
          id="release-distributor"
          label={t('distribution.releases.fields.distributor')}
          value={form.distributor_id}
          onChange={(e) => setForm((f) => ({ ...f, distributor_id: e.target.value }))}
          options={distributors.map((d) => ({ label: `${d.name} (${d.code})`, value: String(d.id) }))}
          placeholder={t('distribution.releases.fields.distributorPlaceholder')}
        />
        <Input
          id="release-date"
          type="date"
          label={t('distribution.releases.fields.releaseDate')}
          value={form.release_date}
          onChange={(e) => setForm((f) => ({ ...f, release_date: e.target.value }))}
        />
        <Input
          id="release-end-date"
          type="date"
          label={t('distribution.releases.fields.endDate')}
          value={form.end_date}
          min={form.release_date || undefined}
          onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
          error={dateOrderError || undefined}
        />
        <p className="text-xs text-txt/60">{t('distribution.releases.fields.endDateHint')}</p>
        <Select
          id="release-form-status"
          label={t('distribution.releases.fields.status')}
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
          options={[
            { label: t('distribution.status.ACTIVE'), value: 'ACTIVE' },
            { label: t('distribution.status.INACTIVE'), value: 'INACTIVE' },
          ]}
        />
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="danger"
            loading={createMut.isPending || updateMut.isPending}
            onClick={submit}
          >
            {t('distribution.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
