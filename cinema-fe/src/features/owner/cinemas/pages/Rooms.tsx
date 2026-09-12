import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { usePermissions } from '@/hooks/usePermissions';
import { ROOM_TYPES, ROOM_STATUSES } from '@/constants/roomType';
import type { Room } from '@/types/entities';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useRoomsByCinema } from '../../hooks/useRoomsByCinema';
import { useCreateRoom } from '../../hooks/useCreateRoom';
import { useUpdateRoom } from '../../hooks/useUpdateRoom';
import { useDeleteRoom } from '../../hooks/useDeleteRoom';
import {
  closeAddRoomModal,
  closeSeatMapModal,
  closeEditRoomModal,
  openAddRoomModal,
  openSeatMapModal,
  openEditRoomModal,
} from '../../store/ownerCinemasSlice';
import type { RoomFormValues } from '../../types/owner.types';
import { SeatMapModal } from '../components/SeatMapModal';
import { AddRoomModal } from '../components/AddRoomModal';
import { EditRoomModal } from '../components/EditRoomModal';
import { RoomsTable } from '../components/RoomsTable';

function Rooms() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const { hasPermission } = usePermissions();
  const { branchId: branchIdParam } = useParams<{ branchId?: string }>();
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const [selectedbranchId, setSelectedbranchId] = useState(branchIdParam ?? '');
  const didAutoSelectCinema = useRef(false);

  useEffect(() => {
    if (branchIdParam) {
      setSelectedbranchId(branchIdParam);
      return;
    }
    if (!didAutoSelectCinema.current && cinemas.length > 0) {
      didAutoSelectCinema.current = true;
      setSelectedbranchId(String(cinemas[0].id));
    }
  }, [branchIdParam, cinemas]);

  const { data: roomsPage, isLoading } = useRoomsByCinema(selectedbranchId || undefined);
  const rooms = useMemo(() => roomsPage?.data ?? [], [roomsPage]);
  const { showAddRoomModal, seatMapRoomId, editingRoomId } = useAppSelector((state) => state.ownerCinemas);
  const createRoomMutation = useCreateRoom();
  const updateRoomMutation = useUpdateRoom(selectedbranchId || undefined);
  const deleteRoomMutation = useDeleteRoom();

  const seatMapRoom = useMemo(() => rooms.find((room) => room.id === seatMapRoomId) ?? null, [rooms, seatMapRoomId]);
  const editingRoom = useMemo(() => rooms.find((room) => room.id === editingRoomId) ?? null, [rooms, editingRoomId]);

  const handleDeleteRoom = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('rooms.deleteConfirm')))) return;
      try {
        await deleteRoomMutation.mutateAsync(id);
        toast.success(t('rooms.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteRoomMutation, t],
  );

  const validateRoom = useCallback(
    (values: RoomFormValues) => {
      const errors: Partial<Record<keyof RoomFormValues, string>> = {};
      if (!values.name.trim()) errors.name = t('rooms.validation.nameRequired');
      if (!values.code.trim()) errors.code = t('rooms.validation.codeRequired');
      if (!(Number(values.capacity) > 0) || !Number.isInteger(Number(values.capacity))) {
        errors.capacity = t('rooms.validation.capacityRequired');
      }
      return errors;
    },
    [t],
  );

  const handleAddRoom = useCallback(
    async (values: RoomFormValues, { resetForm }: FormikHelpers<RoomFormValues>) => {
      if (!selectedbranchId) return;
      try {
        await createRoomMutation.mutateAsync({
          name: values.name,
          cinema_id: Number(selectedbranchId),
          code: values.code,
          type: values.type,
          capacity: Number(values.capacity),
        });
        toast.success(t('rooms.createSuccess'));
        resetForm();
        dispatch(closeAddRoomModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [selectedbranchId, createRoomMutation, dispatch, t],
  );

  const handleUpdateRoom = useCallback(
    async (values: RoomFormValues) => {
      if (!editingRoom) return;
      try {
        await updateRoomMutation.mutateAsync({
          id: editingRoom.id,
          name: values.name,
          code: values.code,
          type: values.type,
          capacity: Number(values.capacity),
          status: values.status as Room['status'],
        });
        toast.success(t('rooms.updateSuccess'));
        dispatch(closeEditRoomModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [editingRoom, updateRoomMutation, dispatch, t],
  );

  const roomTypeOptions = ROOM_TYPES.map((type) => ({ label: type, value: type }));
  const roomStatusOptions = ROOM_STATUSES.map((status) => ({ label: t(`rooms.statusLabels.${status}`), value: status }));

  return (
    <AdminLayout breadcrumb={t('rooms.breadcrumb')} loading={isLoading}>
      <div className="mb-4 max-w-xs">
        <Select
          value={selectedbranchId}
          onChange={(e) => setSelectedbranchId(e.target.value)}
          options={cinemas.map((cinema) => ({ label: cinema.name, value: cinema.id }))}
          placeholder={t('rooms.selectCinemaPlaceholder')}
        />
      </div>

      {hasPermission('room.create') && (
        <Button type="button" variant="danger" disabled={!selectedbranchId} onClick={() => dispatch(openAddRoomModal())}>
          {t('rooms.addButton')}
        </Button>
      )}

      {showAddRoomModal && (
        <AddRoomModal
          onClose={() => dispatch(closeAddRoomModal())}
          onSubmit={handleAddRoom}
          validate={validateRoom}
          roomTypeOptions={roomTypeOptions}
          isPending={createRoomMutation.isPending}
        />
      )}

      {editingRoom && (
        <EditRoomModal
          room={editingRoom}
          onClose={() => dispatch(closeEditRoomModal())}
          onSubmit={handleUpdateRoom}
          validate={validateRoom}
          roomTypeOptions={roomTypeOptions}
          roomStatusOptions={roomStatusOptions}
          isPending={updateRoomMutation.isPending}
        />
      )}

      {seatMapRoom && <SeatMapModal key={seatMapRoom.id} room={seatMapRoom} onClose={() => dispatch(closeSeatMapModal())} />}

      <RoomsTable
        rooms={rooms}
        onSeatMap={(id) => dispatch(openSeatMapModal(id))}
        onEdit={(id) => dispatch(openEditRoomModal(id))}
        onDelete={handleDeleteRoom}
      />
    </AdminLayout>
  );
}

export default Rooms;
