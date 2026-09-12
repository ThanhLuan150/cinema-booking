import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { Employee, Shift, ShiftAssignment } from '@/types/entities';
import { formatAssignmentTime } from '../constants';

interface ShiftAssignmentTableProps {
  assignments: ShiftAssignment[];
  employeeById: Map<number, Employee>;
  shiftById: Map<number, Shift>;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canUpdate: boolean;
  canDelete: boolean;
  onCancel: (assignmentId: number) => void;
  onDelete: (assignmentId: number) => void;
}

export function ShiftAssignmentTable({
  assignments,
  employeeById,
  shiftById,
  page,
  totalPages,
  onPageChange,
  canUpdate,
  canDelete,
  onCancel,
  onDelete,
}: ShiftAssignmentTableProps) {
  const { t } = useTranslation('owner');

  return (
    <div className="mt-6">
      <DataTable
        headers={[
          t('shiftAssignments.headers.id'),
          t('shiftAssignments.headers.employee'),
          t('shiftAssignments.headers.shift'),
          t('shiftAssignments.headers.date'),
          t('shiftAssignments.headers.time'),
          t('shiftAssignments.headers.status'),
          t('shiftAssignments.headers.actions'),
        ]}
      >
        {assignments.map((assignment) => {
          const employee = employeeById.get(assignment.employee_id);
          const shift = shiftById.get(assignment.shift_id);
          return (
            <tr key={assignment.id}>
              <td>{assignment.id}</td>
              <td>{employee?.name || employee?.employee_code || assignment.employee_id}</td>
              <td>{shift?.name || assignment.shift_id}</td>
              <td>{assignment.date}</td>
              <td>
                {formatAssignmentTime(assignment.start_at)} - {formatAssignmentTime(assignment.end_at)}
              </td>
              <td>
                <Badge variant={assignment.status === 'ACTIVE' ? 'success' : 'default'}>
                  {assignment.status === 'ACTIVE' ? t('shiftAssignments.statusActive') : t('shiftAssignments.statusCancelled')}
                </Badge>
              </td>
              <td>
                <div className="flex flex-wrap gap-3">
                  {assignment.status === 'ACTIVE' && canUpdate && (
                    <button
                      type="button"
                      className="text-sm font-medium text-txt/70 transition-colors hover:text-txt"
                      onClick={() => onCancel(assignment.id)}
                    >
                      {t('shiftAssignments.cancel')}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                      onClick={() => onDelete(assignment.id)}
                    >
                      {t('shiftAssignments.delete')}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
