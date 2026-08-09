import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { Room } from '@/types/entities';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useRoomsByCinema } from '../../hooks/useRoomsByCinema';
import { useCreateRoom } from '../../hooks/useCreateRoom';
import { useDeleteRoom } from '../../hooks/useDeleteRoom';
import { useSeatsByRoom } from '../../hooks/useSeatsByRoom';
import { useGenerateSeatMap } from '../../hooks/useGenerateSeatMap';
import { useUpdateSeat } from '../../hooks/useUpdateSeat';
import { closeAddRoomModal, closeSeatMapModal, openAddRoomModal, openSeatMapModal } from '../../store/ownerCinemasSlice';
import type { SeatMapFormValues } from '../../types/owner.types';
import { SEAT_TYPES, SEAT_TYPE_CLASS } from '@/constants/seatType';

const emptySeatMapForm = (): SeatMapFormValues => ({
  rowsInput: 'A,B,C,D,E',
  seatsPerRow: '8',
  vipRows: 'A',
  coupleRows: '',
});

function SeatMapModal({ room, onClose }: { room: Room; onClose: () => void }) {
  const { t } = useTranslation('owner');
  const SEAT_TYPE_LABEL = t('rooms.seatMapModal.seatTypeLabels', { returnObjects: true }) as unknown as string[];
  const { data: seats = [] } = useSeatsByRoom(room.id);
  const generateSeatMapMutation = useGenerateSeatMap();
  const updateSeatMutation = useUpdateSeat();

  const toggleLock = useCallback(
    async (seat: { id: number; is_locked: boolean }) => {
      try {
        await updateSeatMutation.mutateAsync({ id: seat.id, isLocked: !seat.is_locked });
      } catch (error) {
        console.error(error);
      }
    },
    [updateSeatMutation],
  );

  const validateSeatMap = useCallback(
    (values: SeatMapFormValues) => {
      const errors: Partial<Record<keyof SeatMapFormValues, string>> = {};
      if (!values.rowsInput.split(',').map((r) => r.trim()).filter(Boolean).length) {
        errors.rowsInput = t('rooms.seatMapModal.validation.rowsRequired');
      }
      if (!(Number(values.seatsPerRow) > 0)) {
        errors.seatsPerRow = t('rooms.seatMapModal.validation.seatsPerRowRequired');
      }
      return errors;
    },
    [t],
  );

  const handleGenerateSeatMap = useCallback(
    async (values: SeatMapFormValues) => {
      if (!(await confirmDialog(t('rooms.seatMapModal.regenerateConfirm')))) return;
      try {
        await generateSeatMapMutation.mutateAsync({
          roomId: room.id,
          payload: {
            rows: values.rowsInput.split(',').map((r) => r.trim()).filter(Boolean),
            seatsPerRow: Number(values.seatsPerRow),
            vipRows: values.vipRows.split(',').map((r) => r.trim()).filter(Boolean),
            coupleRows: values.coupleRows.split(',').map((r) => r.trim()).filter(Boolean),
          },
        });
        toast.success(t('rooms.seatMapModal.generateSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [generateSeatMapMutation, room.id, t],
  );

  return (
    <Modal open onClose={onClose} title={t('rooms.seatMapModal.title', { roomName: room.name })} className="max-w-2xl">
      <Formik<SeatMapFormValues> initialValues={emptySeatMapForm()} validate={validateSeatMap} onSubmit={handleGenerateSeatMap}>
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form className="mb-4 grid grid-cols-2 gap-3">
              <Field
                as={Input}
                label={t('rooms.seatMapModal.rowsLabel')}
                name="rowsInput"
                error={showErrors ? formik.errors.rowsInput : undefined}
              />
              <Field
                as={Input}
                label={t('rooms.seatMapModal.seatsPerRowLabel')}
                type="number"
                name="seatsPerRow"
                error={showErrors ? formik.errors.seatsPerRow : undefined}
              />
              <Field as={Input} label={t('rooms.seatMapModal.vipRowsLabel')} name="vipRows" />
              <Field as={Input} label={t('rooms.seatMapModal.coupleRowsLabel')} name="coupleRows" />
              <div className="col-span-2">
                <Button type="submit" variant="danger" loading={generateSeatMapMutation.isPending}>
                  {t('rooms.seatMapModal.generateButton')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>

      {seats.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-1">
            {seats.map((seat) => (
              <button
                key={seat.id}
                type="button"
                title={`${SEAT_TYPE_LABEL[seat.seat_type]}${seat.is_locked ? t('rooms.seatMapModal.lockedSuffix') : ''}`}
                onClick={() => toggleLock(seat)}
                className={
                  'h-8 w-10 rounded text-xs text-black ' +
                  (seat.is_locked
                    ? 'bg-gray-500 text-white line-through'
                    : seat.seat_type === SEAT_TYPES.vip
                      ? SEAT_TYPE_CLASS[SEAT_TYPES.vip]
                      : seat.seat_type === SEAT_TYPES.couple
                        ? SEAT_TYPE_CLASS[SEAT_TYPES.couple]
                        : 'bg-gray-300')
                }
              >
                {seat.seat_code}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-txt/50">{t('rooms.seatMapModal.clickHint')}</p>
        </>
      ) : (
        <EmptyState title={t('rooms.seatMapModal.emptyTitle')} description={t('rooms.seatMapModal.emptyDescription')} />
      )}
    </Modal>
  );
}

function Rooms() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
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

  const { data: roomsPage } = useRoomsByCinema(selectedbranchId || undefined);
  const rooms = useMemo(() => roomsPage?.data ?? [], [roomsPage]);
  const { showAddRoomModal, seatMapRoomId } = useAppSelector((state) => state.ownerCinemas);
  const createRoomMutation = useCreateRoom();
  const deleteRoomMutation = useDeleteRoom();

  const seatMapRoom = useMemo(() => rooms.find((room) => room.id === seatMapRoomId) ?? null, [rooms, seatMapRoomId]);

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
    (values: { name: string }) => {
      const errors: Partial<Record<'name', string>> = {};
      if (!values.name.trim()) errors.name = t('rooms.validation.nameRequired');
      return errors;
    },
    [t],
  );

  const handleAddRoom = useCallback(
    async (values: { name: string }, { resetForm }: FormikHelpers<{ name: string }>) => {
      if (!selectedbranchId) return;
      try {
        await createRoomMutation.mutateAsync({ name: values.name, cinema_id: Number(selectedbranchId) });
        toast.success(t('rooms.createSuccess'));
        resetForm();
        dispatch(closeAddRoomModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [selectedbranchId, createRoomMutation, dispatch, t],
  );

  return (
    <AdminLayout breadcrumb={t('rooms.breadcrumb')}>
      <div className="mb-4 max-w-xs">
        <Select
          value={selectedbranchId}
          onChange={(e) => setSelectedbranchId(e.target.value)}
          options={cinemas.map((cinema) => ({ label: cinema.name, value: cinema.id }))}
          placeholder={t('rooms.selectCinemaPlaceholder')}
        />
      </div>

      <Button type="button" variant="danger" disabled={!selectedbranchId} onClick={() => dispatch(openAddRoomModal())}>
        {t('rooms.addButton')}
      </Button>

      {showAddRoomModal && (
        <Modal open onClose={() => dispatch(closeAddRoomModal())} title={t('rooms.addTitle')}>
          <Formik initialValues={{ name: '' }} validate={validateRoom} onSubmit={handleAddRoom}>
            {(formik) => (
              <Form>
                <Field
                  as={Input}
                  label={t('rooms.nameLabel')}
                  name="name"
                  error={formik.submitCount > 0 ? formik.errors.name : undefined}
                />
                <div className="mt-6 flex justify-end">
                  <Button type="submit" variant="danger" loading={createRoomMutation.isPending}>
                    {t('rooms.submit')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </Modal>
      )}

      {seatMapRoom && <SeatMapModal key={seatMapRoom.id} room={seatMapRoom} onClose={() => dispatch(closeSeatMapModal())} />}

      <div className="mt-6">
        <DataTable headers={[t('rooms.headers.id'), t('rooms.headers.name'), t('rooms.headers.actions')]}>
          {rooms.map((room) => (
            <tr key={room.id}>
              <td>{room.id}</td>
              <td>{room.name}</td>
              <td className="flex gap-3">
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => dispatch(openSeatMapModal(room.id))}
                >
                  {t('rooms.seatMapAction')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => handleDeleteRoom(room.id)}
                >
                  {t('rooms.delete')}
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </AdminLayout>
  );
}

export default Rooms;
