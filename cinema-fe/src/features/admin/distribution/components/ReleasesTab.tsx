import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyMovies } from '@/features/admin/movies/hooks/useMyMovies';
import type { MovieRelease } from '@/types/entities';
import { useDeleteMovieRelease, useMovieReleases } from '../hooks/useMovieReleases';
import { statusBadge } from './StatusBadge';
import { ReleaseFormModal } from './ReleaseFormModal';

export function ReleasesTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [movieFilter, setMovieFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'INACTIVE'>('');

  const { data, isLoading } = useMovieReleases(
    { movieId: movieFilter || undefined, status: statusFilter || undefined },
    { page, limit: DEFAULT_PAGE_SIZE },
  );
  const rows = data?.data ?? [];

  const { data: moviesPage } = useMyMovies(1, FULL_LIST_FETCH_LIMIT);
  const movies = useMemo(() => moviesPage?.data ?? [], [moviesPage]);

  const deleteMut = useDeleteMovieRelease();

  const [editing, setEditing] = useState<MovieRelease | null>(null);
  const [open, setOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (r: MovieRelease) => {
    setEditing(r);
    setOpen(true);
  };

  const remove = async (r: MovieRelease) => {
    if (!(await confirmDialog(t('distribution.releases.deleteConfirm')))) return;
    try {
      await deleteMut.mutateAsync(r.id);
      toast.success(t('distribution.releases.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Select
            id="release-movie-filter"
            label={t('distribution.releases.filters.movie')}
            value={movieFilter}
            onChange={(e) => {
              setPage(1);
              setMovieFilter(e.target.value);
            }}
            options={[
              { label: t('distribution.releases.filters.allMovies'), value: '' },
              ...movies.map((m) => ({ label: m.name, value: String(m.id) })),
            ]}
          />
        </div>
        <div className="w-44">
          <Select
            id="release-status-filter"
            label={t('distribution.filters.status')}
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as '' | 'ACTIVE' | 'INACTIVE');
            }}
            options={[
              { label: t('distribution.filters.allStatuses'), value: '' },
              { label: t('distribution.status.ACTIVE'), value: 'ACTIVE' },
              { label: t('distribution.status.INACTIVE'), value: 'INACTIVE' },
            ]}
          />
        </div>
        {canManage && (
          <Button type="button" variant="danger" onClick={openCreate}>
            {t('distribution.releases.addButton')}
          </Button>
        )}
      </div>

      <DataTable
        headers={[
          t('distribution.releases.headers.movie'),
          t('distribution.releases.headers.distributor'),
          t('distribution.releases.headers.releaseDate'),
          t('distribution.releases.headers.endDate'),
          t('distribution.releases.headers.status'),
          t('distribution.releases.headers.actions'),
        ]}
      >
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="font-medium">{r.movie?.name ?? `#${r.movie_id}`}</td>
            <td>
              {r.distributor ? `${r.distributor.name} (${r.distributor.code})` : `#${r.distributor_id}`}
            </td>
            <td>{r.release_date}</td>
            <td>{r.end_date || t('distribution.releases.openEnded')}</td>
            <td>{statusBadge(r.status, t)}</td>
            <td className="flex flex-wrap gap-3">
              {canManage ? (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => openEdit(r)}
                  >
                    {t('distribution.edit')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 hover:text-red-400"
                    onClick={() => remove(r)}
                  >
                    {t('distribution.delete')}
                  </button>
                </>
              ) : (
                <span className="text-sm text-txt/40">—</span>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      {!isLoading && rows.length === 0 && (
        <p className="mt-4 text-sm text-txt/60">{t('distribution.releases.empty')}</p>
      )}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {open && <ReleaseFormModal editing={editing} onClose={() => setOpen(false)} />}
    </>
  );
}
