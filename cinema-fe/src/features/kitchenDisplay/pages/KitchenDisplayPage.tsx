import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { KdsOrderCard } from '../components/KdsOrderCard';
import { KdsCancelModal } from '../components/KdsCancelModal';
import { KdsDragGhost } from '../components/KdsDragGhost';
import { useKdsBoard, useKdsBranches, useUpdateKdsStatus } from '../hooks/useKdsBoard';
import { useKdsDrag } from '../hooks/useKdsDrag';
import type { KdsOrder, KdsTargetStatus } from '../types/kds.types';
import {
  KDS_LANES,
  dropTargetFor,
  formatClock,
  groupOrdersByLane,
  pickDefaultBranchId,
  serverClockOffset,
} from '../utils/kdsBoard';

// Elapsed timers only show whole minutes, so re-rendering twice a minute is plenty.
const CLOCK_TICK_MS = 15_000;

const LANE_ACCENT = {
  NEW: 'border-t-blue-400',
  PREPARING: 'border-t-orange-400',
  READY: 'border-t-purple-400',
  DONE: 'border-t-gray-500',
} as const;

// An order already moved on screen (by a tap or a drop) while the server confirms. `settledAt` is
// when the server said yes: the override is dropped once a board fetched after that arrives.
interface PendingMove {
  status: KdsTargetStatus;
  settledAt: number | null;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function KitchenDisplayPage() {
  const { t, i18n } = useTranslation('kitchenDisplay');
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('combo.order.update');
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();

  // An Employee's KDS is the branch they are staffed at (cinema_id, filled in server-side). Anyone
  // else holding combo.order.view (the Super Admin) picks the kitchen to watch from the branches the
  // server says they may open, each shown with how many orders are waiting there.
  const staffedBranchId = currentUser?.cinema_id ?? null;
  const needsBranchPicker = !userLoading && !staffedBranchId;
  const { data: branchList } = useKdsBranches(!userLoading);
  const branches = useMemo(() => branchList ?? [], [branchList]);
  const [pickedBranchId, setPickedBranchId] = useState('');
  // Open the busiest kitchen first — decided once, when the list first arrives, so the board does not
  // jump to another branch later just because the counts changed.
  useEffect(() => {
    if (needsBranchPicker && !pickedBranchId && branches.length > 0) {
      setPickedBranchId(String(pickDefaultBranchId(branches)));
    }
  }, [needsBranchPicker, pickedBranchId, branches]);
  const branchId = staffedBranchId ?? (pickedBranchId ? Number(pickedBranchId) : null);
  const branchName = branches.find((branch) => branch.id === branchId)?.name;

  const {
    data: board,
    isLoading,
    isError,
    error,
    dataUpdatedAt,
    refetch,
    isFetching,
  } = useKdsBoard(branchId);
  const updateMutation = useUpdateKdsStatus(branchId);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<KdsOrder | null>(null);
  const [moves, setMoves] = useState<Record<number, PendingMove>>({});

  // Drop an on-screen move once the board shows it (or a board fetched after the server confirmed
  // arrives — someone may have moved the order on again since).
  useEffect(() => {
    if (!board) return;
    setMoves((current) => {
      const statusById = new Map(board.orders.map((order) => [order.id, order.status]));
      const kept = Object.entries(current).filter(([id, move]) => {
        const status = statusById.get(Number(id));
        if (status === undefined || status === move.status) return false;
        return move.settledAt === null || dataUpdatedAt < move.settledAt;
      });
      return kept.length === Object.keys(current).length ? current : Object.fromEntries(kept);
    });
  }, [board, dataUpdatedAt]);

  const localNow = useNow(CLOCK_TICK_MS);
  const offset = board ? serverClockOffset(board.server_time, dataUpdatedAt) : 0;
  const nowMs = localNow + offset;
  const lanes = useMemo(() => {
    const shown = (board?.orders ?? []).map((order) => {
      const move = moves[order.id];
      // Moved but unconfirmed: shown in its new lane, with no further actions until it settles.
      return move ? { ...order, status: move.status, next_statuses: [] } : order;
    });
    return groupOrdersByLane(shown);
  }, [board, moves]);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  // One path for a tap on the button and a drop on a lane: move the card at once, then confirm with
  // the server; if it refuses (e.g. someone else got there first) the card goes back and says why.
  const runUpdate = async (order: KdsOrder, status: KdsTargetStatus, reason?: string) => {
    setPendingOrderId(order.id);
    setMoves((current) => ({ ...current, [order.id]: { status, settledAt: null } }));
    try {
      await updateMutation.mutateAsync({ orderId: order.id, status, reason });
      setMoves((current) =>
        current[order.id] ? { ...current, [order.id]: { status, settledAt: Date.now() } } : current,
      );
      toast.success(t(`success.${status}`, { code: order.code }));
      return true;
    } catch (err) {
      setMoves((current) => {
        const { [order.id]: _undone, ...rest } = current;
        return rest;
      });
      toast.error(getApiErrorMessage(err, t));
      return false;
    } finally {
      setPendingOrderId(null);
    }
  };

  const { drag, startPress } = useKdsDrag({
    enabled: canUpdate,
    onDrop: (order, status) => void runUpdate(order, status),
  });

  return (
    <AdminLayout
      breadcrumb={t('breadcrumb')}
      loading={userLoading || (branchId !== null && isLoading)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {needsBranchPicker && branches.length > 0 ? (
            <div className="w-72">
              <Select
                aria-label={t('branchLabel')}
                value={branchId ?? ''}
                options={branches.map((branch) => ({
                  label: t('branchOption', { name: branch.name, count: branch.active }),
                  value: branch.id,
                }))}
                onChange={(event) => setPickedBranchId(event.target.value)}
              />
            </div>
          ) : (
            branchName && <h2 className="text-lg font-semibold">{branchName}</h2>
          )}
          {board && (
            <div className="flex flex-wrap gap-2 text-sm" aria-label={t('summary')}>
              {(['NEW', 'PREPARING', 'READY'] as const).map((status) => (
                <span key={status} className="rounded-full bg-white/10 px-3 py-1">
                  {t(`status.${status}`)}:{' '}
                  <strong className="tabular-nums">{board.counts[status]}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-txt/60">
          {dataUpdatedAt > 0 && (
            <span>
              {t('lastUpdated', {
                time: formatClock(new Date(dataUpdatedAt).toISOString(), locale),
              })}
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={isFetching}
            onClick={() => refetch()}
            disabled={branchId === null}
          >
            {t('refresh')}
          </Button>
        </div>
      </div>

      {canUpdate && board && (
        <p className="mt-3 flex items-center gap-2 text-xs text-txt/60">
          <i className="fa-solid fa-hand-pointer" aria-hidden="true" />
          {t('dragHint')}
        </p>
      )}
      {!canUpdate && board && (
        <Alert className="mt-4" variant="info">
          {t('readOnly')}
        </Alert>
      )}
      {needsBranchPicker && branchList && branches.length === 0 && (
        <Alert className="mt-4" variant="info">
          {t('noBranch')}
        </Alert>
      )}
      {isError && (
        <Alert className="mt-4" variant="error">
          {t('loadError')} {getApiErrorMessage(error, t)}
        </Alert>
      )}
      {board?.truncated && (
        <Alert className="mt-4" variant="warning">
          {t('truncated', { count: board.orders.length })}
        </Alert>
      )}

      {board && (
        <div
          className={cn(
            'mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4',
            drag && 'cursor-grabbing select-none',
          )}
        >
          {KDS_LANES.map((lane) => {
            const isTarget = drag?.lane === lane;
            const isOver = isTarget && drag?.over === lane;
            return (
              <section
                key={lane}
                data-kds-lane={lane}
                data-drop-target={isTarget || undefined}
                aria-label={t(`lanes.${lane}`, { minutes: board.recent_minutes })}
                className={cn(
                  'flex min-h-[12rem] flex-col gap-3 rounded-xl border-t-4 bg-white/[0.03] p-3 transition',
                  LANE_ACCENT[lane],
                  isTarget && 'ring-2 ring-accent/60',
                  isOver && 'bg-accent/10 ring-accent',
                  drag && !isTarget && 'opacity-50',
                )}
              >
                <h2 className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-txt/80">
                  <span>{t(`lanes.${lane}`, { minutes: board.recent_minutes })}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 tabular-nums">
                    {lanes[lane].length}
                  </span>
                </h2>
                {isTarget && drag && (
                  <div className="rounded-lg border-2 border-dashed border-accent/70 py-3 text-center text-sm font-medium text-accent">
                    {t(`drop.${drag.status}`)}
                  </div>
                )}
                {lanes[lane].length === 0
                  ? !isTarget && (
                      <p className="py-6 text-center text-sm text-txt/40">{t('emptyLane')}</p>
                    )
                  : lanes[lane].map((order) => (
                      <KdsOrderCard
                        key={order.id}
                        order={order}
                        nowMs={nowMs}
                        canUpdate={canUpdate}
                        pending={pendingOrderId === order.id}
                        draggable={
                          canUpdate &&
                          pendingOrderId !== order.id &&
                          !moves[order.id] &&
                          dropTargetFor(order) !== null
                        }
                        dragging={drag?.order.id === order.id}
                        saving={Boolean(moves[order.id])}
                        onPointerDown={startPress(order)}
                        onAdvance={(target, status) => void runUpdate(target, status)}
                        onCancel={setCancelling}
                      />
                    ))}
              </section>
            );
          })}
        </div>
      )}

      {drag && <KdsDragGhost drag={drag} />}

      <KdsCancelModal
        order={cancelling}
        pending={cancelling !== null && pendingOrderId === cancelling.id}
        onClose={() => setCancelling(null)}
        onSubmit={async (order, reason) => {
          if (await runUpdate(order, 'CANCELLED', reason)) setCancelling(null);
        }}
      />
    </AdminLayout>
  );
}

export default KitchenDisplayPage;
