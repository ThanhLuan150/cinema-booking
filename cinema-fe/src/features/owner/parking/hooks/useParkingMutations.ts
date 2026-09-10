import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  cancelParkingTicket,
  createParkingArea,
  createParkingSlot,
  deleteParkingArea,
  deleteParkingSlot,
  enterVehicle,
  exitVehicle,
  payParkingTicket,
  updateParkingArea,
  updateParkingSlot,
  type ParkingAreaPayload,
  type ParkingSlotPayload,
  type VehicleEntryPayload,
} from '../api/parking.api';
import { parkingAreasQueryKey } from './useParkingAreas';
import { parkingSlotsQueryKey } from './useParkingSlots';
import { parkingTicketsQueryKey } from './useParkingTickets';

type QC = ReturnType<typeof useQueryClient>;
const invalidateAreas = (qc: QC) => qc.invalidateQueries({ queryKey: parkingAreasQueryKey });
const invalidateSlots = (qc: QC) => qc.invalidateQueries({ queryKey: parkingSlotsQueryKey });
const invalidateTickets = (qc: QC) => qc.invalidateQueries({ queryKey: parkingTicketsQueryKey });

// Anything that opens or closes a parking session also moves a slot between AVAILABLE and
// OCCUPIED, so ticket mutations invalidate the slot list too.
const invalidateFlow = (qc: QC) => {
  invalidateTickets(qc);
  invalidateSlots(qc);
};

export function useCreateParkingArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ParkingAreaPayload) => createParkingArea(payload),
    onSuccess: () => invalidateAreas(qc),
  });
}

export function useUpdateParkingArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ParkingAreaPayload & { id: number | string }) => updateParkingArea(id, payload),
    onSuccess: () => invalidateAreas(qc),
  });
}

export function useDeleteParkingArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteParkingArea(id),
    onSuccess: () => {
      invalidateAreas(qc);
      invalidateSlots(qc);
    },
  });
}

export function useCreateParkingSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ParkingSlotPayload) => createParkingSlot(payload),
    onSuccess: () => invalidateSlots(qc),
  });
}

export function useUpdateParkingSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ParkingSlotPayload & { id: number | string }) => updateParkingSlot(id, payload),
    onSuccess: () => invalidateSlots(qc),
  });
}

export function useDeleteParkingSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteParkingSlot(id),
    onSuccess: () => invalidateSlots(qc),
  });
}

export function useEnterVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: VehicleEntryPayload) => enterVehicle(payload),
    onSuccess: () => invalidateFlow(qc),
  });
}

export function useExitVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => exitVehicle(id),
    onSuccess: () => invalidateFlow(qc),
  });
}

export function usePayParkingTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => payParkingTicket(id),
    onSuccess: () => invalidateFlow(qc),
  });
}

export function useCancelParkingTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => cancelParkingTicket(id),
    onSuccess: () => invalidateFlow(qc),
  });
}
