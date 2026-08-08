import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEmployee, deactivateEmployee, resetEmployeePassword, updateEmployee } from '../api/owner.api';
import { myEmployeesQueryKey } from './useMyEmployees';
import type { EmployeeFormValues } from '../types/owner.types';

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmployeeFormValues) =>
      createEmployee({ ...payload, cinema_id: Number(payload.cinema_id), position_id: Number(payload.position_id) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myEmployeesQueryKey }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, position_id }: { id: number | string; status?: number; position_id?: number }) =>
      updateEmployee(id, { status, position_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myEmployeesQueryKey }),
  });
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deactivateEmployee(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myEmployeesQueryKey }),
  });
}

export function useResetEmployeePassword() {
  return useMutation({
    mutationFn: (id: number | string) => resetEmployeePassword(id),
  });
}
