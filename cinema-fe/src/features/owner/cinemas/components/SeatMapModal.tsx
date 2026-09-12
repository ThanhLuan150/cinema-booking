import { useCallback } from 'react';
import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Room } from '@/types/entities';
import { useSeatsByRoom } from '../../hooks/useSeatsByRoom';
import { useGenerateSeatMap } from '../../hooks/useGenerateSeatMap';
import { useUpdateSeat } from '../../hooks/useUpdateSeat';
import type { SeatMapFormValues } from '../../types/owner.types';
import { SEAT_TYPES, SEAT_TYPE_CLASS } from '@/constants/seatType';
import { emptySeatMapForm } from '../constants';

export function SeatMapModal({ room, onClose }: { room: Room; onClose: () => void }) {
  const { t } = useTranslation('owner');
  const SEAT_TYPE_LABEL = t('rooms.seatMapModal.seatTypeLabels', { returnObjects: true }) as unknown as string[];
  const { data: seats = [] } = useSeatsByRoom(room.id);
  const generateSeatMapMutation = useGenerateSeatMap();
  const updateSeatMutation = useUpdateSeat();

  const toggleDisabled = useCallback(
    async (seat: { id: number; status: 'ACTIVE' | 'DISABLED' }) => {
      try {
        await updateSeatMutation.mutateAsync({ id: seat.id, status: seat.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' });
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
                title={`${SEAT_TYPE_LABEL[seat.seat_type]}${seat.status === 'DISABLED' ? t('rooms.seatMapModal.disabledSuffix') : ''}`}
                onClick={() => toggleDisabled(seat)}
                className={
                  'h-8 w-10 rounded text-xs text-black ' +
                  (seat.status === 'DISABLED'
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
