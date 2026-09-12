import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { PrivateEvent, PrivateEventStatus } from '@/types/entities';
import {
  useApprovePrivateEvent,
  useCompletePrivateEvent,
  useConfirmPrivateEvent,
  usePrivateEventsAdmin,
  useQuotePrivateEvent,
  useRejectPrivateEvent,
} from '@/features/privateEvents/hooks/usePrivateEvents';
import { ALL_BRANCHES } from '../constants';
import { PrivateEventFilters } from '../components/PrivateEventFilters';
import { PrivateEventTable } from '../components/PrivateEventTable';
import { QuoteModal } from '../components/QuoteModal';

function PrivateEventsList() {
  const { t } = useTranslation('privateEvents');
  const isAdmin = useAuthRole() === ROLES.admin;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [quoteFor, setQuoteFor] = useState<PrivateEvent | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');

  const { data: currentUser } = useCurrentUser();
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const isAllBranches = selectedBranchId === ALL_BRANCHES;

  useEffect(() => {
    if (selectedBranchId) return;
    if (isAdmin) setSelectedBranchId(ALL_BRANCHES);
    else if (currentUser?.cinema_id) setSelectedBranchId(String(currentUser.cinema_id));
    else if (cinemas.length > 0) setSelectedBranchId(String(cinemas[0].id));
  }, [cinemas, selectedBranchId, isAdmin, currentUser]);

  const branchParam = isAllBranches ? undefined : selectedBranchId || undefined;
  const { data, isLoading } = usePrivateEventsAdmin(
    branchParam,
    page,
    DEFAULT_PAGE_SIZE,
    (status || undefined) as PrivateEventStatus | undefined,
    { enabled: Boolean(selectedBranchId) },
  );
  const events = data?.data ?? [];

  const quote = useQuotePrivateEvent();
  const approve = useApprovePrivateEvent();
  const confirm = useConfirmPrivateEvent();
  const complete = useCompletePrivateEvent();
  const reject = useRejectPrivateEvent();

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const submitQuote = async () => {
    if (!quoteFor) return;
    const amount = Number(quoteAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error(t('admin.invalidAmount'));
      return;
    }
    await run(t('admin.quoted'), () =>
      quote.mutateAsync({ id: quoteFor.id, arg: { amount, notes: quoteNotes.trim() || undefined } }),
    );
    setQuoteFor(null);
    setQuoteAmount('');
    setQuoteNotes('');
  };

  const handleReject = async (ev: PrivateEvent) => {
    if (!(await confirmDialog(t('admin.rejectConfirm')))) return;
    await run(t('admin.rejected'), () => reject.mutateAsync({ id: ev.id, arg: undefined }));
  };

  return (
    <AdminLayout breadcrumb={t('admin.breadcrumb')} loading={isLoading}>
      <PrivateEventFilters
        isAdmin={isAdmin}
        cinemas={cinemas}
        selectedBranchId={selectedBranchId}
        onBranchChange={(branchId) => {
          setSelectedBranchId(branchId);
          setPage(1);
        }}
        status={status}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />

      <PrivateEventTable
        events={events}
        isAllBranches={isAllBranches}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        onQuote={(ev) => {
          setQuoteFor(ev);
          setQuoteAmount(ev.quoted_amount != null ? String(ev.quoted_amount) : '');
          setQuoteNotes(ev.quote_notes || '');
        }}
        onApprove={(ev) => run(t('admin.approved'), () => approve.mutateAsync({ id: ev.id }))}
        onConfirm={(ev) => run(t('admin.confirmed'), () => confirm.mutateAsync({ id: ev.id }))}
        onComplete={(ev) => run(t('admin.completed'), () => complete.mutateAsync({ id: ev.id }))}
        onReject={handleReject}
      />

      {quoteFor && (
        <QuoteModal
          event={quoteFor}
          amount={quoteAmount}
          onAmountChange={setQuoteAmount}
          notes={quoteNotes}
          onNotesChange={setQuoteNotes}
          isSubmitting={quote.isPending}
          onClose={() => setQuoteFor(null)}
          onSubmit={submitQuote}
        />
      )}
    </AdminLayout>
  );
}

export default PrivateEventsList;
