import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { IncidentCategory, IncidentSeverity } from '@/types/entities';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useCreateIncident, useIncidents } from '../../hooks/useIncidents';

const CATEGORIES: IncidentCategory[] = ['THEFT', 'DISTURBANCE', 'MEDICAL', 'FIRE_SAFETY', 'SUSPICIOUS', 'OTHER'];
const SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];
const SEVERITY_VARIANT = { LOW: 'default', MEDIUM: 'warning', HIGH: 'accent' } as const;

// What is shown here follows the caller's permissions, but that is presentation only: the
// backend re-checks incident.create / incident.read and the branch on every request.
function IncidentsPage() {
  const { t } = useTranslation('owner');
  const { hasPermission } = usePermissions();
  const isEmployee = useAuthRole() === ROLES.employee;
  const { data: currentUser } = useCurrentUser();
  // An Employee holds no branch.read (so /cinema/mine would 403) and works a single branch,
  // which /user already reports as cinema_id.
  const { data: cinemasPage } = useMyCinemas({ enabled: !isEmployee });
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);

  const [chosenBranch, setChosenBranch] = useState('');
  const employeeBranch = currentUser?.cinema_id ? String(currentUser.cinema_id) : '';
  const adminBranch = chosenBranch || (cinemas[0] ? String(cinemas[0].id) : '');
  const branchId = isEmployee ? employeeBranch : adminBranch;

  const [page, setPage] = useState(1);
  const { data, isLoading } = useIncidents(branchId || undefined, page, DEFAULT_PAGE_SIZE);
  const createIncident = useCreateIncident();

  const [category, setCategory] = useState<IncidentCategory>('OTHER');
  const [severity, setSeverity] = useState<IncidentSeverity>('LOW');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!title.trim() || !branchId) return;
    try {
      await createIncident.mutateAsync({
        branch_id: Number(branchId),
        category,
        severity,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      toast.success(t('incidents.createSuccess'));
      setTitle('');
      setDescription('');
      setSubmitted(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AdminLayout breadcrumb={t('incidents.breadcrumb')} loading={isLoading}>
      {!isEmployee && (
        <div className="mb-4 max-w-xs">
          <Select
            value={branchId}
            onChange={(e) => {
              setChosenBranch(e.target.value);
              setPage(1);
            }}
            placeholder={t('incidents.branchPlaceholder')}
            options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
          />
        </div>
      )}

      {hasPermission('incident.create') && (
        <form onSubmit={handleSubmit} className="mb-6 grid max-w-2xl gap-3" aria-label={t('incidents.formTitle')}>
          <h2 className="text-lg font-semibold text-txt">{t('incidents.formTitle')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t('incidents.categoryLabel')}
              value={category}
              onChange={(e) => setCategory(e.target.value as IncidentCategory)}
              options={CATEGORIES.map((c) => ({ label: t(`incidents.category.${c}`), value: c }))}
            />
            <Select
              label={t('incidents.severityLabel')}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
              options={SEVERITIES.map((sv) => ({ label: t(`incidents.severity.${sv}`), value: sv }))}
            />
          </div>
          <Input
            id="incident-title"
            label={t('incidents.titleLabel')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={submitted && !title.trim() ? t('incidents.titleRequired') : undefined}
          />
          <Textarea
            id="incident-description"
            label={t('incidents.descriptionLabel')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <div>
            <Button type="submit" variant="danger" loading={createIncident.isPending} disabled={!branchId}>
              {t('incidents.submit')}
            </Button>
          </div>
        </form>
      )}

      {hasPermission('incident.read') && (
        <>
          <DataTable
            headers={[
              t('incidents.headers.id'),
              t('incidents.headers.time'),
              t('incidents.headers.category'),
              t('incidents.headers.severity'),
              t('incidents.headers.title'),
              t('incidents.headers.description'),
            ]}
          >
            {(data?.data ?? []).map((incident) => (
              <tr key={incident.id}>
                <td>{incident.id}</td>
                <td>{new Date(incident.createdAt).toLocaleString()}</td>
                <td>{t(`incidents.category.${incident.category}`)}</td>
                <td>
                  <Badge variant={SEVERITY_VARIANT[incident.severity]}>{t(`incidents.severity.${incident.severity}`)}</Badge>
                </td>
                <td>{incident.title}</td>
                <td>{incident.description}</td>
              </tr>
            ))}
          </DataTable>
          <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}
    </AdminLayout>
  );
}

export default IncidentsPage;
