import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyMovies } from '@/features/admin/movies/hooks/useMyMovies';
import type { Distributor, MovieRelease } from '@/types/entities';
import {
  useAllDistributors,
  useCreateDistributor,
  useDeleteDistributor,
  useDistributors,
  useUpdateDistributor,
} from '../hooks/useDistributors';
import {
  useCreateMovieRelease,
  useDeleteMovieRelease,
  useMovieReleases,
  useUpdateMovieRelease,
} from '../hooks/useMovieReleases';

type Tab = 'releases' | 'distributors';

function statusBadge(status: string, t: (k: string) => string) {
  return status === 'ACTIVE' ? (
    <Badge variant="success">{t('distribution.status.ACTIVE')}</Badge>
  ) : (
    <Badge variant="outline">{t('distribution.status.INACTIVE')}</Badge>
  );
}

/* ------------------------------- Distributors ------------------------------- */

interface DistributorForm {
  name: string;
  code: string;
  contact_email: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const emptyDistributor: DistributorForm = {
  name: '',
  code: '',
  contact_email: '',
  phone: '',
  status: 'ACTIVE',
};

function DistributorsTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'INACTIVE'>('');

  const { data, isLoading } = useDistributors(
    { search: search.trim() || undefined, status: statusFilter || undefined },
    { page, limit: DEFAULT_PAGE_SIZE },
  );
  const rows = data?.data ?? [];

  const createMut = useCreateDistributor();
  const updateMut = useUpdateDistributor();
  const deleteMut = useDeleteDistributor();

  const [editing, setEditing] = useState<Distributor | null>(null);
  const [form, setForm] = useState<DistributorForm>(emptyDistributor);
  const [open, setOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyDistributor);
    setOpen(true);
  };
  const openEdit = (d: Distributor) => {
    setEditing(d);
    setForm({
      name: d.name,
      code: d.code,
      contact_email: d.contact_email ?? '',
      phone: d.phone ?? '',
      status: d.status,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t('distribution.distributors.validation.required'));
      return;
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...form });
        toast.success(t('distribution.distributors.updateSuccess'));
      } else {
        await createMut.mutateAsync(form);
        toast.success(t('distribution.distributors.createSuccess'));
      }
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const remove = async (d: Distributor) => {
    if (!(await confirmDialog(t('distribution.distributors.deleteConfirm', { name: d.name })))) return;
    try {
      await deleteMut.mutateAsync(d.id);
      toast.success(t('distribution.distributors.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <Input
            id="distributor-search"
            label={t('distribution.distributors.searchLabel')}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder={t('distribution.distributors.searchPlaceholder')}
          />
        </div>
        <div className="w-44">
          <Select
            id="distributor-status"
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
            {t('distribution.distributors.addButton')}
          </Button>
        )}
      </div>

      <DataTable
        headers={[
          t('distribution.distributors.headers.name'),
          t('distribution.distributors.headers.code'),
          t('distribution.distributors.headers.email'),
          t('distribution.distributors.headers.phone'),
          t('distribution.distributors.headers.status'),
          t('distribution.distributors.headers.actions'),
        ]}
      >
        {rows.map((d) => (
          <tr key={d.id}>
            <td className="font-medium">{d.name}</td>
            <td>{d.code}</td>
            <td>{d.contact_email || '—'}</td>
            <td>{d.phone || '—'}</td>
            <td>{statusBadge(d.status, t)}</td>
            <td className="flex flex-wrap gap-3">
              {canManage ? (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => openEdit(d)}
                  >
                    {t('distribution.edit')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 hover:text-red-400"
                    onClick={() => remove(d)}
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
        <p className="mt-4 text-sm text-txt/60">{t('distribution.distributors.empty')}</p>
      )}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={
            editing
              ? t('distribution.distributors.editTitle', { name: editing.name })
              : t('distribution.distributors.addTitle')
          }
          className="max-w-lg"
        >
          <div className="space-y-3">
            <Input
              id="distributor-name"
              label={t('distribution.distributors.fields.name')}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              id="distributor-code"
              label={t('distribution.distributors.fields.code')}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
            <Input
              id="distributor-email"
              type="email"
              label={t('distribution.distributors.fields.email')}
              value={form.contact_email}
              onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
            />
            <Input
              id="distributor-phone"
              label={t('distribution.distributors.fields.phone')}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Select
              id="distributor-form-status"
              label={t('distribution.distributors.fields.status')}
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
      )}
    </>
  );
}

/* ------------------------------ Movie releases ----------------------------- */

interface ReleaseForm {
  movie_id: string;
  distributor_id: string;
  release_date: string;
  end_date: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const emptyRelease: ReleaseForm = {
  movie_id: '',
  distributor_id: '',
  release_date: '',
  end_date: '',
  status: 'ACTIVE',
};

function ReleasesTab({ canManage }: { canManage: boolean }) {
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
  const { data: distributors = [] } = useAllDistributors('ACTIVE');

  const createMut = useCreateMovieRelease();
  const updateMut = useUpdateMovieRelease();
  const deleteMut = useDeleteMovieRelease();

  const [editing, setEditing] = useState<MovieRelease | null>(null);
  const [form, setForm] = useState<ReleaseForm>(emptyRelease);
  const [open, setOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyRelease);
    setOpen(true);
  };
  const openEdit = (r: MovieRelease) => {
    setEditing(r);
    setForm({
      movie_id: String(r.movie_id),
      distributor_id: String(r.distributor_id),
      release_date: r.release_date,
      end_date: r.end_date ?? '',
      status: r.status,
    });
    setOpen(true);
  };

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
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
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

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
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
      )}
    </>
  );
}

/* --------------------------------- Page ---------------------------------- */

function DistributionPage() {
  const { t } = useTranslation('admin');
  const { hasPermission } = usePermissions();
  const canSeeDistributors = hasPermission('distributor.read');
  const canManageDistributors = hasPermission('distributor.manage');
  const canManageReleases = hasPermission('movieRelease.manage');

  const [tab, setTab] = useState<Tab>('releases');
  const activeTab: Tab = tab === 'distributors' && !canSeeDistributors ? 'releases' : tab;

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={
        activeTab === value
          ? 'border-b-2 border-accent px-4 py-2 text-sm font-semibold text-accent'
          : 'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-txt/60 hover:text-txt'
      }
    >
      {label}
    </button>
  );

  return (
    <AdminLayout breadcrumb={t('distribution.breadcrumb')}>
      {canSeeDistributors && (
        <div className="mb-6 flex gap-2 border-b border-border">
          {tabButton('releases', t('distribution.tabs.releases'))}
          {tabButton('distributors', t('distribution.tabs.distributors'))}
        </div>
      )}

      {activeTab === 'distributors' && canSeeDistributors ? (
        <DistributorsTab canManage={canManageDistributors} />
      ) : (
        <ReleasesTab canManage={canManageReleases} />
      )}
    </AdminLayout>
  );
}

export default DistributionPage;
