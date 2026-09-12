import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
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
import type { SupportTicketStatus, User } from '@/types/entities';
import { ALL_BRANCHES } from '../constants';
import type { CreateTicketFormValues } from '../types/customerService.types';
import { useSupportTickets } from '../hooks/useSupportTickets';
import {
  useAssignSupportTicket,
  useClaimSupportTicket,
  useCloseSupportTicket,
  useCreateSupportTicket,
  useDeleteSupportTicket,
  useResolveSupportTicket,
} from '../hooks/useSupportTicketMutations';
import { SupportTicketFilters } from '../components/SupportTicketFilters';
import { CreateTicketModal } from '../components/CreateTicketModal';
import { AssignTicketModal } from '../components/AssignTicketModal';
import { ResolveTicketModal } from '../components/ResolveTicketModal';
import { SupportTicketsTable } from '../components/SupportTicketsTable';

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

  const { data, isLoading } = useSupportTickets(
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

  return (
    <AdminLayout breadcrumb={t('breadcrumb')} loading={isLoading}>
      <SupportTicketFilters
        isEmployee={isEmployee}
        isAdmin={isAdmin}
        cinemas={cinemas}
        selectedbranchId={selectedbranchId}
        statusFilter={statusFilter}
        canCreate={hasPermission('supportTicket.create')}
        isAllBranches={isAllBranches}
        onBranchChange={setSelectedbranchId}
        onStatusFilterChange={setStatusFilter}
        onCreate={() => setShowCreateModal(true)}
      />

      {showCreateModal && (
        <CreateTicketModal
          createCustomer={createCustomer}
          onSelectCustomer={setCreateCustomer}
          onClose={closeCreateModal}
          onSubmit={handleCreate}
          submitPending={createMutation.isPending}
        />
      )}

      {assignTicket && (
        <AssignTicketModal
          employees={employees}
          onClose={() => setAssignTicketId(null)}
          onSubmit={handleAssign}
          submitPending={assignMutation.isPending}
        />
      )}

      {resolveTicket && (
        <ResolveTicketModal
          onClose={() => setResolveTicketId(null)}
          onSubmit={handleResolve}
          submitPending={resolveMutation.isPending}
        />
      )}

      <SupportTicketsTable
        tickets={tickets}
        isAllBranches={isAllBranches}
        branchNameById={branchNameById}
        employeeNameById={employeeNameById}
        hasPermission={hasPermission}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        onClaim={handleClaim}
        onAssign={setAssignTicketId}
        onResolve={setResolveTicketId}
        onClose={handleClose}
        onDelete={handleDelete}
      />
    </AdminLayout>
  );
}

export default SupportTicketsPage;
