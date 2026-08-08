import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEmployee, deactivateEmployee, updateEmployee } from '../api/owner.api';
import { myEmployeesQueryKey } from './useMyEmployees';
import type { EmployeeFormValues } from '../types/owner.types';

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmployeeFormValues) =>
      createEmployee({ ...payload, cinema_id: Number(payload.cinema_id) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myEmployeesQueryKey }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number | string; status: number }) => updateEmployee(id, { status }),
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
