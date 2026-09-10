import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Pagination } from '@/components/ui/Pagination';
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

const ALL_BRANCHES = 'ALL';
const STATUSES: PrivateEventStatus[] = [
  'REQUESTED',
  'QUOTED',
  'APPROVED',
  'PAID',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
];
const STATUS_VARIANT: Record<PrivateEventStatus, 'default' | 'warning' | 'success'> = {
  REQUESTED: 'warning',
  QUOTED: 'warning',
  APPROVED: 'warning',
  PAID: 'success',
  CONFIRMED: 'success',
  COMPLETED: 'default',
  CANCELLED: 'default',
};

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

  const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : '—');

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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setPage(1);
            }}
            placeholder={t('admin.branchPlaceholder')}
            options={[
              ...(isAdmin ? [{ label: t('admin.allBranches'), value: ALL_BRANCHES }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
            ]}
          />
        </div>
        <div className="max-w-xs flex-1">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            placeholder={t('admin.statusFilter')}
            options={STATUSES.map((s) => ({ label: t(`status.${s}`), value: s }))}
          />
        </div>
      </div>

      <DataTable
        headers={[
          t('admin.headers.id'),
          ...(isAllBranches ? [t('admin.headers.branch')] : []),
          t('admin.headers.title'),
          t('admin.headers.room'),
          t('admin.headers.window'),
          t('admin.headers.guests'),
          t('admin.headers.quote'),
          t('admin.headers.status'),
          t('admin.headers.actions'),
        ]}
      >
        {events.map((ev) => (
          <tr key={ev.id}>
            <td>#{ev.id}</td>
            {isAllBranches && <td>{ev.branch_id}</td>}
            <td>
              <div className="font-medium text-white">{ev.title || t('mine.untitled', { id: ev.id })}</div>
              <div className="text-xs text-txt/55">{ev.contact_name || ev.contact_phone || ev.contact_email || '—'}</div>
            </td>
            <td>#{ev.room_id}</td>
            <td className="text-sm text-txt/70">
              {fmt(ev.start_at)}
              <br />
              {fmt(ev.end_at)}
            </td>
            <td>{ev.guest_count}</td>
            <td>{ev.quoted_amount != null ? `${ev.quoted_amount.toLocaleString()}đ` : '—'}</td>
            <td>
              <Badge variant={STATUS_VARIANT[ev.status]}>{t(`status.${ev.status}`)}</Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              {ev.status === 'REQUESTED' && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-hover"
                  onClick={() => {
                    setQuoteFor(ev);
                    setQuoteAmount(ev.quoted_amount != null ? String(ev.quoted_amount) : '');
                    setQuoteNotes(ev.quote_notes || '');
                  }}
                >
                  {t('admin.quote')}
                </button>
              )}
              {ev.status === 'QUOTED' && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-hover"
                  onClick={() => run(t('admin.approved'), () => approve.mutateAsync({ id: ev.id }))}
                >
                  {t('admin.approve')}
                </button>
              )}
              {ev.status === 'PAID' && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-hover"
                  onClick={() => run(t('admin.confirmed'), () => confirm.mutateAsync({ id: ev.id }))}
                >
                  {t('admin.confirm')}
                </button>
              )}
              {ev.status === 'CONFIRMED' && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:text-accent-hover"
                  onClick={() => run(t('admin.completed'), () => complete.mutateAsync({ id: ev.id }))}
                >
                  {t('admin.complete')}
                </button>
              )}
              {!['COMPLETED', 'CANCELLED'].includes(ev.status) && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 hover:text-red-400"
                  onClick={() => handleReject(ev)}
                >
                  {t('admin.reject')}
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {quoteFor && (
        <Modal open onClose={() => setQuoteFor(null)} title={t('admin.quoteTitle', { id: quoteFor.id })}>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface-soft p-3 text-sm text-txt/75">
              <p>{t('mine.window', { start: fmt(quoteFor.start_at), end: fmt(quoteFor.end_at) })}</p>
              <p className="text-xs text-txt/55">
                {t('mine.meta', { branch: quoteFor.branch_id, room: quoteFor.room_id, guests: quoteFor.guest_count })}
              </p>
              {quoteFor.notes && <p className="mt-1 italic">“{quoteFor.notes}”</p>}
            </div>
            <Input
              id="pe-quote-amount"
              type="number"
              min={0}
              label={t('admin.amount')}
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
            />
            <Textarea
              id="pe-quote-notes"
              rows={3}
              label={t('admin.quoteNotes')}
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
            />
            <div className="flex justify-end pt-1">
              <Button type="button" variant="danger" loading={quote.isPending} onClick={submitQuote}>
                {t('admin.sendQuote')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

export default PrivateEventsList;
