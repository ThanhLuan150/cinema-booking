import { useCallback, useEffect, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { useMyEmployees } from '@/features/owner/hooks/useMyEmployees';
import type { SupportTicket, SupportTicketCategory, SupportTicketStatus, User } from '@/types/entities';
import { CustomerLabel } from '../components/CustomerLabel';
import { CustomerPicker } from '../components/CustomerPicker';
import { useSupportTickets } from '../hooks/useSupportTickets';
import {
  useAssignSupportTicket,
  useClaimSupportTicket,
  useCloseSupportTicket,
  useCreateSupportTicket,
  useDeleteSupportTicket,
  useResolveSupportTicket,
} from '../hooks/useSupportTicketMutations';

const ALL_BRANCHES = 'ALL';
const CATEGORIES: SupportTicketCategory[] = ['GENERAL', 'COMPLAINT', 'BOOKING_SUPPORT', 'REFUND_SUPPORT', 'SHOWTIME_CHANGE'];
const STATUSES: SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const STATUS_VARIANT: Record<SupportTicketStatus, 'warning' | 'accent' | 'success' | 'default'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'accent',
  RESOLVED: 'success',
  CLOSED: 'default',
};

interface CreateTicketFormValues {
  subject: string;
  description: string;
  category: SupportTicketCategory;
}

function SupportTicketsPage() {
  const { t } = useTranslation('customerService');
  const isAdmin = useAuthRole() === ROLES.admin;
  const isEmployee = useAuthRole() === ROLES.employee;
  const { hasPermission } = usePermissions();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedbranchId, setSelectedbranchId] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCustomer, setCreateCustomer] = useState<User | null>(null);
  const [assignTicketId, setAssignTicketId] = useState<number | null>(null);
  const [resolveTicketId, setResolveTicketId] = useState<number | null>(null);

  const { data: currentUser } = useCurrentUser();
  const { data: cinemasPage } = useMyCinemas({ enabled: !isEmployee });
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);
  const isAllBranches = selectedbranchId === ALL_BRANCHES;

  useEffect(() => {
    if (selectedbranchId) return;
    if (isEmployee) {
      if (currentUser?.cinema_id) setSelectedbranchId(String(currentUser.cinema_id));
    } else if (isAdmin) {
      setSelectedbranchId(ALL_BRANCHES);
    } else if (cinemas.length > 0) {
      setSelectedbranchId(String(cinemas[0].id));
    }
  }, [cinemas, selectedbranchId, isAdmin, isEmployee, currentUser]);

  const { data } = useSupportTickets(
    isAllBranches ? undefined : selectedbranchId || undefined,
    page,
    DEFAULT_PAGE_SIZE,
    { status: (statusFilter || undefined) as SupportTicketStatus | undefined },
    { enabled: Boolean(selectedbranchId) },
  );
  const tickets = useMemo(() => data?.data ?? [], [data]);

  const { data: employeesPage } = useMyEmployees(isAllBranches ? undefined : selectedbranchId || undefined, 1, FULL_LIST_FETCH_LIMIT);
  const employees = useMemo(() => (employeesPage?.data ?? []).filter((e) => e.status === 1), [employeesPage]);
  const employeeNameById = useMemo(
    () => new Map(employees.map((e) => [e.id, e.name || e.email || `#${e.id}`])),
    [employees],
  );

  const assignTicket = useMemo(() => tickets.find((tk) => tk.id === assignTicketId) ?? null, [tickets, assignTicketId]);
  const resolveTicket = useMemo(() => tickets.find((tk) => tk.id === resolveTicketId) ?? null, [tickets, resolveTicketId]);

  const createMutation = useCreateSupportTicket();
  const claimMutation = useClaimSupportTicket();
  const assignMutation = useAssignSupportTicket();
  const resolveMutation = useResolveSupportTicket();
  const closeMutation = useCloseSupportTicket();
  const deleteMutation = useDeleteSupportTicket();

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setCreateCustomer(null);
  }, []);

  const handleCreate = useCallback(
    async (values: CreateTicketFormValues, { resetForm }: FormikHelpers<CreateTicketFormValues>) => {
      if (!createCustomer) return;
      try {
        await createMutation.mutateAsync({
          branch_id: Number(selectedbranchId),
          customer_id: createCustomer.id,
          category: values.category,
          subject: values.subject.trim(),
          description: values.description.trim(),
        });
        toast.success(t('createSuccess'));
        resetForm();
        closeCreateModal();
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createCustomer, createMutation, selectedbranchId, closeCreateModal, t],
  );

  const handleClaim = useCallback(
    async (id: number) => {
      try {
        await claimMutation.mutateAsync(id);
        toast.success(t('claimSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [claimMutation, t],
  );

  const handleAssign = useCallback(
    async (values: { employee_id: string }) => {
      if (!assignTicket) return;
      try {
        await assignMutation.mutateAsync({ id: assignTicket.id, employee_id: Number(values.employee_id) });
        toast.success(t('assignSuccess'));
        setAssignTicketId(null);
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [assignTicket, assignMutation, t],
  );

  const handleResolve = useCallback(
    async (values: { resolution_note: string }) => {
      if (!resolveTicket) return;
      try {
        await resolveMutation.mutateAsync({ id: resolveTicket.id, resolution_note: values.resolution_note.trim() || undefined });
        toast.success(t('resolveSuccess'));
        setResolveTicketId(null);
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [resolveTicket, resolveMutation, t],
  );

  const handleClose = useCallback(
    async (id: number) => {
      try {
        await closeMutation.mutateAsync(id);
        toast.success(t('closeSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [closeMutation, t],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('deleteConfirm')))) return;
      try {
        await deleteMutation.mutateAsync(id);
        toast.success(t('deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteMutation, t],
  );

  const statusOptions = STATUSES.map((status) => ({ label: t(`status.${status}`), value: status }));
  const categoryOptions = CATEGORIES.map((category) => ({ label: t(`category.${category}`), value: category }));

  return (
    <AdminLayout breadcrumb={t('breadcrumb')}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {!isEmployee && (
          <div className="max-w-xs flex-1">
            <Select
              value={selectedbranchId}
              onChange={(e) => setSelectedbranchId(e.target.value)}
              placeholder={t('branchPlaceholder')}
              options={[
                ...(isAdmin ? [{ label: t('allBranches'), value: ALL_BRANCHES }] : []),
                ...cinemas.map((c) => ({ label: c.name, value: c.id })),
              ]}
            />
          </div>
        )}
        <div className="max-w-xs flex-1">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder={t('statusFilterPlaceholder')}
            options={statusOptions}
          />
        </div>
        {hasPermission('supportTicket.create') && !isAllBranches && (
          <Button type="button" variant="danger" onClick={() => setShowCreateModal(true)}>
            {t('newButton')}
          </Button>
        )}
      </div>

      {showCreateModal && (
        <Modal open onClose={closeCreateModal} title={t('createTitle')}>
          <CustomerPicker selected={createCustomer} onSelect={setCreateCustomer} />
          <Formik<CreateTicketFormValues>
            initialValues={{ subject: '', description: '', category: 'GENERAL' }}
            validate={(values) => {
              const errors: Partial<Record<keyof CreateTicketFormValues, string>> = {};
              if (!values.subject.trim()) errors.subject = t('validation.subjectRequired');
              return errors;
            }}
            onSubmit={handleCreate}
          >
            {(formik) => (
              <Form>
                <Field
                  as={Select}
                  label={t('categoryLabel')}
                  name="category"
                  className="mt-3"
                  options={categoryOptions}
                />
                <Field
                  as={Input}
                  label={t('subjectLabel')}
                  name="subject"
                  className="mt-3"
                  error={formik.submitCount > 0 ? formik.errors.subject : undefined}
                />
                <Field as={Textarea} label={t('descriptionLabel')} name="description" className="mt-3" rows={3} />
                <div className="mt-6 flex justify-end">
                  <Button type="submit" variant="danger" loading={createMutation.isPending} disabled={!createCustomer}>
                    {t('submit')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </Modal>
      )}

      {assignTicket && (
        <Modal open onClose={() => setAssignTicketId(null)} title={t('assignTitle')}>
          <Formik initialValues={{ employee_id: '' }} onSubmit={handleAssign}>
            {(formik) => (
              <Form>
                <Field
                  as={Select}
                  label={t('employeeLabel')}
                  name="employee_id"
                  options={employees.map((e) => ({ label: e.name || e.email || `#${e.id}`, value: e.id }))}
                  placeholder={t('employeePlaceholder')}
                />
                <div className="mt-6 flex justify-end">
                  <Button type="submit" variant="danger" loading={assignMutation.isPending} disabled={!formik.values.employee_id}>
                    {t('submit')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </Modal>
      )}

      {resolveTicket && (
        <Modal open onClose={() => setResolveTicketId(null)} title={t('resolveTitle')}>
          <Formik initialValues={{ resolution_note: '' }} onSubmit={handleResolve}>
            <Form>
              <Field as={Textarea} label={t('resolutionNoteLabel')} name="resolution_note" rows={3} />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={resolveMutation.isPending}>
                  {t('submit')}
                </Button>
              </div>
            </Form>
          </Formik>
        </Modal>
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('headers.id'),
            ...(isAllBranches ? [t('headers.branch')] : []),
            t('headers.customer'),
            t('headers.category'),
            t('headers.subject'),
            t('headers.assignee'),
            t('headers.status'),
            t('headers.actions'),
          ]}
        >
          {tickets.map((ticket: SupportTicket) => (
            <tr key={ticket.id}>
              <td>{ticket.id}</td>
              {isAllBranches && <td>{branchNameById.get(ticket.branch_id) || ticket.branch_id}</td>}
              <td>
                <CustomerLabel customerId={ticket.customer_id} />
              </td>
              <td>{t(`category.${ticket.category}`)}</td>
              <td>{ticket.subject}</td>
              <td>{ticket.assigned_employee_id ? employeeNameById.get(ticket.assigned_employee_id) || `#${ticket.assigned_employee_id}` : t('unassigned')}</td>
              <td>
                <Badge variant={STATUS_VARIANT[ticket.status]}>{t(`status.${ticket.status}`)}</Badge>
              </td>
              <td className="flex flex-wrap gap-3">
                {ticket.status === 'OPEN' && hasPermission('supportTicket.update') && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleClaim(ticket.id)}
                  >
                    {t('claim')}
                  </button>
                )}
                {(ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') && hasPermission('supportTicket.assign') && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => setAssignTicketId(ticket.id)}
                  >
                    {t('assign')}
                  </button>
                )}
                {ticket.status === 'IN_PROGRESS' && hasPermission('supportTicket.update') && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => setResolveTicketId(ticket.id)}
                  >
                    {t('resolve')}
                  </button>
                )}
                {ticket.status === 'RESOLVED' && hasPermission('supportTicket.close') && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleClose(ticket.id)}
                  >
                    {t('close')}
                  </button>
                )}
                {ticket.status === 'OPEN' && hasPermission('supportTicket.delete') && (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                    onClick={() => handleDelete(ticket.id)}
                  >
                    {t('delete')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default SupportTicketsPage;
