import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { Employee } from '@/types/entities';

interface EmployeeTableProps {
  employees: Employee[];
  isAllBranches: boolean;
  branchNameById: Map<number, string>;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canUpdate: boolean;
  canDelete: boolean;
  onDeactivate: (employeeId: number) => void;
  onReactivate: (employeeId: number) => void;
  onResetPassword: (employeeId: number) => void;
}

export function EmployeeTable({
  employees,
  isAllBranches,
  branchNameById,
  page,
  totalPages,
  onPageChange,
  canUpdate,
  canDelete,
  onDeactivate,
  onReactivate,
  onResetPassword,
}: EmployeeTableProps) {
  const { t } = useTranslation('owner');

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('employees.headers.id'),
          ...(isAllBranches ? [t('employees.headers.branch')] : []),
          t('employees.headers.employeeCode'),
          t('employees.headers.name'),
          t('employees.headers.email'),
          t('employees.headers.position'),
          t('employees.headers.status'),
          t('employees.headers.actions'),
        ]}
      >
        {employees.map((employee) => (
          <tr key={employee.id}>
            <td>{employee.id}</td>
            {isAllBranches && <td>{branchNameById.get(employee.branch_id) ?? employee.branch_id}</td>}
            <td>{employee.employee_code}</td>
            <td>{employee.name}</td>
            <td>{employee.email}</td>
            <td>{employee.position?.name}</td>
            <td>
              <Badge variant={employee.status === 1 ? 'success' : 'default'}>
                {employee.status === 1 ? t('employees.statusActive') : t('employees.statusInactive')}
              </Badge>
            </td>
            <td>
              <div className="flex flex-wrap gap-3">
                {employee.status === 1
                  ? canDelete && (
                      <button
                        type="button"
                        className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                        onClick={() => onDeactivate(employee.id)}
                      >
                        {t('employees.deactivate')}
                      </button>
                    )
                  : canUpdate && (
                      <button
                        type="button"
                        className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                        onClick={() => onReactivate(employee.id)}
                      >
                        {t('employees.reactivate')}
                      </button>
                    )}
                {canUpdate && (
                  <button
                    type="button"
                    className="text-sm font-medium text-txt/70 transition-colors hover:text-txt"
                    onClick={() => onResetPassword(employee.id)}
                  >
                    {t('employees.resetPassword')}
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
