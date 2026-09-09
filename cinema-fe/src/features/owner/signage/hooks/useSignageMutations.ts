import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createContent,
  createScreen,
  createSignageSchedule,
  deleteContent,
  deleteScreen,
  deleteSignageSchedule,
  updateContent,
  updateScreen,
  updateSignageSchedule,
  type ContentPayload,
  type ScreenPayload,
  type SignageSchedulePayload,
} from '../api/signage.api';
import { screenPlaybackQueryKey, screensQueryKey } from './useScreens';
import { signageContentsQueryKey } from './useSignageContents';
import { signageSchedulesQueryKey } from './useSignageSchedules';

type QC = ReturnType<typeof useQueryClient>;
const invalidateScreens = (qc: QC) => qc.invalidateQueries({ queryKey: screensQueryKey });
const invalidateContents = (qc: QC) => qc.invalidateQueries({ queryKey: signageContentsQueryKey });
const invalidateSchedules = (qc: QC) => {
  qc.invalidateQueries({ queryKey: signageSchedulesQueryKey });
  qc.invalidateQueries({ queryKey: screenPlaybackQueryKey });
};

export function useCreateScreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScreenPayload) => createScreen(payload),
    onSuccess: () => invalidateScreens(qc),
  });
}

export function useUpdateScreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ScreenPayload & { id: number | string }) => updateScreen(id, payload),
    onSuccess: () => {
      invalidateScreens(qc);
      invalidateSchedules(qc);
    },
  });
}

export function useDeleteScreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteScreen(id),
    onSuccess: () => invalidateScreens(qc),
  });
}

export function useCreateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContentPayload) => createContent(payload),
    onSuccess: () => invalidateContents(qc),
  });
}

export function useUpdateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ContentPayload & { id: number | string }) => updateContent(id, payload),
    onSuccess: () => {
      invalidateContents(qc);
      invalidateSchedules(qc);
    },
  });
}

export function useDeleteContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteContent(id),
    onSuccess: () => invalidateContents(qc),
  });
}

export function useCreateSignageSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SignageSchedulePayload) => createSignageSchedule(payload),
    onSuccess: () => invalidateSchedules(qc),
  });
}

export function useUpdateSignageSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: SignageSchedulePayload & { id: number | string }) =>
      updateSignageSchedule(id, payload),
    onSuccess: () => invalidateSchedules(qc),
  });
}

export function useDeleteSignageSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteSignageSchedule(id),
    onSuccess: () => invalidateSchedules(qc),
  });
}
