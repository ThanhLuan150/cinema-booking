import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
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
import type {
  ParkingArea,
  ParkingAreaStatus,
  ParkingSlot,
  ParkingSlotStatus,
  ParkingTicket,
  ParkingTicketStatus,
  ParkingVehicleType,
} from '@/types/entities';
import { useParkingAreas } from '../hooks/useParkingAreas';
import { useParkingSlots } from '../hooks/useParkingSlots';
import { useParkingTickets } from '../hooks/useParkingTickets';
import {
  useCancelParkingTicket,
  useCreateParkingArea,
  useCreateParkingSlot,
  useDeleteParkingArea,
  useDeleteParkingSlot,
  useEnterVehicle,
  useExitVehicle,
  usePayParkingTicket,
  useUpdateParkingArea,
  useUpdateParkingSlot,
} from '../hooks/useParkingMutations';

const ALL_BRANCHES = 'ALL';
const AREA_STATUSES: ParkingAreaStatus[] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
const SLOT_STATUSES: ParkingSlotStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'];
const VEHICLE_TYPES: ParkingVehicleType[] = ['CAR', 'MOTORBIKE', 'BICYCLE', 'OTHER'];
const TICKET_STATUSES: ParkingTicketStatus[] = ['ACTIVE', 'PENDING_PAYMENT', 'COMPLETED', 'CANCELLED'];

const AREA_STATUS_VARIANT: Record<ParkingAreaStatus, 'success' | 'default' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  MAINTENANCE: 'warning',
};
const SLOT_STATUS_VARIANT: Record<ParkingSlotStatus, 'success' | 'warning' | 'default'> = {
  AVAILABLE: 'success',
  OCCUPIED: 'warning',
  RESERVED: 'default',
  MAINTENANCE: 'default',
};
const TICKET_STATUS_VARIANT: Record<ParkingTicketStatus, 'success' | 'warning' | 'default'> = {
  ACTIVE: 'warning',
  PENDING_PAYMENT: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
};

interface AreaForm {
  name: string;
  capacity: string;
  status: ParkingAreaStatus;
}
interface EntryForm {
  vehicle_type: ParkingVehicleType;
  vehicle_plate: string;
  slot_id: string;
}

const emptyAreaForm: AreaForm = { name: '', capacity: '0', status: 'ACTIVE' };
const emptyEntryForm: EntryForm = { vehicle_type: 'CAR', vehicle_plate: '', slot_id: '' };

function ParkingList() {
  const { t } = useTranslation('owner');
  const isAdmin = useAuthRole() === ROLES.admin;
  const { hasPermission } = usePermissions();

  const [ticketPage, setTicketPage] = useState(1);
  const [ticketStatus, setTicketStatus] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

  const { data: currentUser } = useCurrentUser();
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const isAllBranches = selectedBranchId === ALL_BRANCHES;
  const concreteBranchId = !isAllBranches && selectedBranchId ? Number(selectedBranchId) : undefined;

  useEffect(() => {
    if (selectedBranchId) return;
    if (isAdmin) setSelectedBranchId(ALL_BRANCHES);
    else if (currentUser?.cinema_id) setSelectedBranchId(String(currentUser.cinema_id));
    else if (cinemas.length > 0) setSelectedBranchId(String(cinemas[0].id));
  }, [cinemas, selectedBranchId, isAdmin, currentUser]);

  const branchParam = isAllBranches ? undefined : selectedBranchId || undefined;
  const listEnabled = Boolean(selectedBranchId);

  const { data: areasPage } = useParkingAreas(branchParam, 1, FULL_LIST_FETCH_LIMIT, undefined, { enabled: listEnabled });
  const areas = useMemo(() => areasPage?.data ?? [], [areasPage]);
  const areaNameById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);

  const { data: ticketsPage, isLoading } = useParkingTickets(
    branchParam,
    ticketPage,
    DEFAULT_PAGE_SIZE,
    { status: (ticketStatus || undefined) as ParkingTicketStatus | undefined },
    { enabled: listEnabled },
  );
  const tickets = useMemo(() => ticketsPage?.data ?? [], [ticketsPage]);

  // Free slots for the current branch, used to populate the "pick a slot" dropdown on entry.
  const { data: freeSlotsPage } = useParkingSlots(
    undefined,
    1,
    FULL_LIST_FETCH_LIMIT,
    { branchId: branchParam, status: 'AVAILABLE' },
    { enabled: listEnabled && !isAllBranches },
  );
  const freeSlots = useMemo(() => freeSlotsPage?.data ?? [], [freeSlotsPage]);

  const createArea = useCreateParkingArea();
  const updateArea = useUpdateParkingArea();
  const deleteArea = useDeleteParkingArea();
  const enterVehicle = useEnterVehicle();
  const exitVehicle = useExitVehicle();
  const payTicket = usePayParkingTicket();
  const cancelTicket = useCancelParkingTicket();

  const [areaModal, setAreaModal] = useState<{ mode: 'create' | 'edit'; area?: ParkingArea } | null>(null);
  const [areaForm, setAreaForm] = useState<AreaForm>(emptyAreaForm);
  const [slotsArea, setSlotsArea] = useState<ParkingArea | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntryForm);
  const [showAreas, setShowAreas] = useState(false);

  const canManage = hasPermission('parking.manage');
  const canOperate = hasPermission('parking.operate');

  const openCreateArea = useCallback(() => {
    setAreaForm(emptyAreaForm);
    setAreaModal({ mode: 'create' });
  }, []);
  const openEditArea = useCallback((area: ParkingArea) => {
    setAreaForm({ name: area.name, capacity: String(area.capacity), status: area.status });
    setAreaModal({ mode: 'edit', area });
  }, []);

  const submitArea = useCallback(async () => {
    try {
      const capacity = Number(areaForm.capacity) || 0;
      if (areaModal?.mode === 'create') {
        if (!concreteBranchId) return;
        await createArea.mutateAsync({ branch_id: concreteBranchId, name: areaForm.name.trim(), capacity, status: areaForm.status });
        toast.success(t('parking.areaCreateSuccess'));
      } else if (areaModal?.area) {
        await updateArea.mutateAsync({ id: areaModal.area.id, name: areaForm.name.trim(), capacity, status: areaForm.status });
        toast.success(t('parking.areaUpdateSuccess'));
      }
      setAreaModal(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  }, [areaModal, areaForm, concreteBranchId, createArea, updateArea, t]);

  const handleDeleteArea = useCallback(
    async (area: ParkingArea) => {
      if (!(await confirmDialog(t('parking.areaDeleteConfirm')))) return;
      try {
        await deleteArea.mutateAsync(area.id);
        toast.success(t('parking.areaDeleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteArea, t],
  );

  const submitEntry = useCallback(async () => {
    if (!concreteBranchId) return;
    try {
      await enterVehicle.mutateAsync({
        branch_id: concreteBranchId,
        vehicle_type: entryForm.vehicle_type,
        vehicle_plate: entryForm.vehicle_plate.trim(),
        slot_id: entryForm.slot_id ? Number(entryForm.slot_id) : null,
      });
      toast.success(t('parking.entrySuccess'));
      setEntryOpen(false);
      setEntryForm(emptyEntryForm);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  }, [concreteBranchId, entryForm, enterVehicle, t]);

  const runTicketAction = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        toast.success(label);
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [t],
  );

  const handleExit = (ticket: ParkingTicket) =>
    runTicketAction(t('parking.exitSuccess'), () => exitVehicle.mutateAsync(ticket.id));
  const handlePay = (ticket: ParkingTicket) =>
    runTicketAction(t('parking.paySuccess'), () => payTicket.mutateAsync(ticket.id));
  const handleCancel = async (ticket: ParkingTicket) => {
    if (!(await confirmDialog(t('parking.cancelConfirm')))) return;
    runTicketAction(t('parking.cancelSuccess'), () => cancelTicket.mutateAsync(ticket.id));
  };

  const ticketStatusOptions = TICKET_STATUSES.map((s) => ({ label: t(`parking.ticketStatus.${s}`), value: s }));
  const slotOptions = [
    { label: t('parking.autoAssign'), value: '' },
    ...freeSlots
      .filter((s) => s.vehicle_type === entryForm.vehicle_type)
      .map((s) => ({ label: `${areaNameById.get(s.parking_area_id) ?? '?'} · ${s.slot_code}`, value: String(s.id) })),
  ];
  const fmtMoney = (n: number) => new Intl.NumberFormat().format(n);
  const fmtTime = (v: string | null) => (v ? new Date(v).toLocaleString() : '—');

  return (
    <AdminLayout breadcrumb={t('parking.breadcrumb')} loading={isLoading}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setTicketPage(1);
            }}
            placeholder={t('parking.branchPlaceholder')}
            options={[
              ...(isAdmin ? [{ label: t('parking.allBranches'), value: ALL_BRANCHES }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: String(c.id) })),
            ]}
          />
        </div>
        <div className="max-w-xs flex-1">
          <Select
            value={ticketStatus}
            onChange={(e) => {
              setTicketStatus(e.target.value);
              setTicketPage(1);
            }}
            placeholder={t('parking.statusFilterPlaceholder')}
            options={ticketStatusOptions}
          />
        </div>
        {canManage && (
          <Button type="button" variant="outline" onClick={() => setShowAreas((v) => !v)}>
            {t('parking.manageAreas')}
          </Button>
        )}
        {canOperate && concreteBranchId && (
          <Button type="button" variant="danger" onClick={() => setEntryOpen(true)}>
            {t('parking.vehicleEntry')}
          </Button>
        )}
      </div>

      {showAreas && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-txt/60">{t('parking.areasTitle')}</h3>
            {canManage && concreteBranchId && (
              <Button type="button" size="sm" variant="secondary" onClick={openCreateArea}>
                {t('parking.addAreaButton')}
              </Button>
            )}
          </div>
          {areas.length === 0 ? (
            <p className="text-sm text-txt/60">{t('parking.noAreas')}</p>
          ) : (
            <DataTable
              headers={[
                t('parking.areaHeaders.name'),
                t('parking.areaHeaders.capacity'),
                t('parking.areaHeaders.status'),
                t('parking.areaHeaders.actions'),
              ]}
            >
              {areas.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.capacity}</td>
                  <td>
                    <Badge variant={AREA_STATUS_VARIANT[a.status]}>{t(`parking.areaStatus.${a.status}`)}</Badge>
                  </td>
                  <td className="flex flex-wrap gap-3">
                    <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => setSlotsArea(a)}>
                      {t('parking.slots')}
                    </button>
                    {canManage && (
                      <>
                        <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => openEditArea(a)}>
                          {t('parking.edit')}
                        </button>
                        <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => handleDeleteArea(a)}>
                          {t('parking.delete')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      )}

      <DataTable
        headers={[
          t('parking.ticketHeaders.code'),
          ...(isAllBranches ? [t('parking.ticketHeaders.branch')] : []),
          t('parking.ticketHeaders.plate'),
          t('parking.ticketHeaders.vehicleType'),
          t('parking.ticketHeaders.slot'),
          t('parking.ticketHeaders.entry'),
          t('parking.ticketHeaders.exit'),
          t('parking.ticketHeaders.fee'),
          t('parking.ticketHeaders.status'),
          t('parking.ticketHeaders.actions'),
        ]}
      >
        {tickets.map((tk) => (
          <tr key={tk.id}>
            <td className="font-mono text-xs">{tk.ticket_code}</td>
            {isAllBranches && <td>{tk.branch_id}</td>}
            <td className="font-mono text-xs">{tk.vehicle_plate}</td>
            <td>{t(`parking.vehicleType.${tk.vehicle_type}`)}</td>
            <td>#{tk.slot_id}</td>
            <td className="text-sm text-txt/70">{fmtTime(tk.entry_at)}</td>
            <td className="text-sm text-txt/70">{fmtTime(tk.exit_at)}</td>
            <td>{tk.fee ? fmtMoney(tk.fee) : '—'}</td>
            <td>
              <Badge variant={TICKET_STATUS_VARIANT[tk.status]}>{t(`parking.ticketStatus.${tk.status}`)}</Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              {canOperate && tk.status === 'ACTIVE' && (
                <>
                  <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => handleExit(tk)}>
                    {t('parking.exit')}
                  </button>
                  <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => handleCancel(tk)}>
                    {t('parking.cancel')}
                  </button>
                </>
              )}
              {canOperate && tk.status === 'PENDING_PAYMENT' && (
                <button type="button" className="text-sm font-medium text-accent hover:text-accent-hover" onClick={() => handlePay(tk)}>
                  {t('parking.takePayment')}
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={ticketPage} totalPages={ticketsPage?.totalPages ?? 1} onPageChange={setTicketPage} />

      {areaModal && (
        <Modal open onClose={() => setAreaModal(null)} title={areaModal.mode === 'create' ? t('parking.addAreaTitle') : t('parking.editAreaTitle')}>
          <div className="space-y-3">
            <Input
              id="parking-area-name"
              label={t('parking.nameLabel')}
              value={areaForm.name}
              onChange={(e) => setAreaForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              id="parking-area-capacity"
              type="number"
              label={t('parking.capacityLabel')}
              value={areaForm.capacity}
              onChange={(e) => setAreaForm((f) => ({ ...f, capacity: e.target.value }))}
            />
            <Select
              label={t('parking.statusLabel')}
              value={areaForm.status}
              options={AREA_STATUSES.map((s) => ({ label: t(`parking.areaStatus.${s}`), value: s }))}
              onChange={(e) => setAreaForm((f) => ({ ...f, status: e.target.value as ParkingAreaStatus }))}
            />
            <div className="flex justify-end pt-2">
              <Button type="button" variant="danger" loading={createArea.isPending || updateArea.isPending} disabled={!areaForm.name.trim()} onClick={submitArea}>
                {t('parking.submit')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {entryOpen && (
        <Modal open onClose={() => setEntryOpen(false)} title={t('parking.entryTitle')}>
          <div className="space-y-3">
            <Select
              label={t('parking.vehicleTypeLabel')}
              value={entryForm.vehicle_type}
              options={VEHICLE_TYPES.map((v) => ({ label: t(`parking.vehicleType.${v}`), value: v }))}
              onChange={(e) => setEntryForm((f) => ({ ...f, vehicle_type: e.target.value as ParkingVehicleType, slot_id: '' }))}
            />
            <Input
              id="parking-entry-plate"
              label={t('parking.plateLabel')}
              value={entryForm.vehicle_plate}
              onChange={(e) => setEntryForm((f) => ({ ...f, vehicle_plate: e.target.value }))}
            />
            <Select
              label={t('parking.slotLabel')}
              value={entryForm.slot_id}
              options={slotOptions}
              onChange={(e) => setEntryForm((f) => ({ ...f, slot_id: e.target.value }))}
            />
            <div className="flex justify-end pt-2">
              <Button type="button" variant="danger" loading={enterVehicle.isPending} disabled={!entryForm.vehicle_plate.trim()} onClick={submitEntry}>
                {t('parking.admit')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {slotsArea && <SlotsModal area={slotsArea} canManage={canManage} onClose={() => setSlotsArea(null)} />}
    </AdminLayout>
  );
}

interface SlotsModalProps {
  area: ParkingArea;
  canManage: boolean;
  onClose: () => void;
}

interface SlotForm {
  slot_code: string;
  vehicle_type: ParkingVehicleType;
  status: ParkingSlotStatus;
}
const emptySlotForm: SlotForm = { slot_code: '', vehicle_type: 'CAR', status: 'AVAILABLE' };

function SlotsModal({ area, canManage, onClose }: SlotsModalProps) {
  const { t } = useTranslation('owner');
  const [page, setPage] = useState(1);
  const { data } = useParkingSlots(area.id, page, DEFAULT_PAGE_SIZE);
  const slots = data?.data ?? [];

  const createSlot = useCreateParkingSlot();
  const updateSlot = useUpdateParkingSlot();
  const deleteSlot = useDeleteParkingSlot();

  const [form, setForm] = useState<SlotForm>(emptySlotForm);
  const [editing, setEditing] = useState<ParkingSlot | null>(null);

  const submit = async () => {
    try {
      if (editing) {
        await updateSlot.mutateAsync({ id: editing.id, slot_code: form.slot_code.trim(), vehicle_type: form.vehicle_type, status: form.status });
        toast.success(t('parking.slotUpdateSuccess'));
      } else {
        await createSlot.mutateAsync({ parking_area_id: area.id, slot_code: form.slot_code.trim(), vehicle_type: form.vehicle_type, status: form.status });
        toast.success(t('parking.slotCreateSuccess'));
      }
      setForm(emptySlotForm);
      setEditing(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const remove = async (slot: ParkingSlot) => {
    if (!(await confirmDialog(t('parking.slotDeleteConfirm')))) return;
    try {
      await deleteSlot.mutateAsync(slot.id);
      toast.success(t('parking.slotDeleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={t('parking.slotsTitle', { name: area.name })} className="max-w-2xl">
      {slots.length === 0 ? (
        <p className="text-sm text-txt/60">{t('parking.noSlots')}</p>
      ) : (
        <DataTable
          headers={[
            t('parking.slotHeaders.code'),
            t('parking.slotHeaders.vehicleType'),
            t('parking.slotHeaders.status'),
            ...(canManage ? [t('parking.slotHeaders.actions')] : []),
          ]}
        >
          {slots.map((s) => (
            <tr key={s.id}>
              <td className="font-mono text-xs">{s.slot_code}</td>
              <td>{t(`parking.vehicleType.${s.vehicle_type}`)}</td>
              <td>
                <Badge variant={SLOT_STATUS_VARIANT[s.status]}>{t(`parking.slotStatus.${s.status}`)}</Badge>
              </td>
              {canManage && (
                <td className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => {
                      setEditing(s);
                      setForm({ slot_code: s.slot_code, vehicle_type: s.vehicle_type, status: s.status });
                    }}
                  >
                    {t('parking.edit')}
                  </button>
                  <button type="button" className="text-sm font-medium text-red-500 hover:text-red-400" onClick={() => remove(s)}>
                    {t('parking.delete')}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </DataTable>
      )}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {canManage && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
          <h4 className="text-sm font-semibold">{editing ? t('parking.editSlotTitle') : t('parking.addSlotTitle')}</h4>
          <Input id="parking-slot-code" label={t('parking.slotCodeLabel')} value={form.slot_code} onChange={(e) => setForm((f) => ({ ...f, slot_code: e.target.value }))} />
          <Select
            label={t('parking.vehicleTypeLabel')}
            value={form.vehicle_type}
            options={VEHICLE_TYPES.map((v) => ({ label: t(`parking.vehicleType.${v}`), value: v }))}
            onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value as ParkingVehicleType }))}
          />
          <Select
            label={t('parking.statusLabel')}
            value={form.status}
            options={SLOT_STATUSES.filter((s) => s !== 'OCCUPIED').map((s) => ({ label: t(`parking.slotStatus.${s}`), value: s }))}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ParkingSlotStatus }))}
          />
          <div className="flex justify-end gap-2">
            {editing && (
              <Button type="button" variant="secondary" onClick={() => { setEditing(null); setForm(emptySlotForm); }}>
                {t('parking.cancel')}
              </Button>
            )}
            <Button type="button" variant="danger" loading={createSlot.isPending || updateSlot.isPending} disabled={!form.slot_code.trim()} onClick={submit}>
              {t('parking.submit')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ParkingList;
