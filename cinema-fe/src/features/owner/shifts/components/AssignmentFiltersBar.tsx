import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { DateInput } from '@/components/ui/DateInput';
import type { Employee } from '@/types/entities';

interface AssignmentFiltersBarProps {
  employees: Employee[];
  employeeFilter: string;
  onEmployeeFilterChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

export function AssignmentFiltersBar({
  employees,
  employeeFilter,
  onEmployeeFilterChange,
  dateFilter,
  onDateFilterChange,
  statusFilter,
  onStatusFilterChange,
}: AssignmentFiltersBarProps) {
  const { t } = useTranslation('owner');

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="w-48">
        <Select
          label={t('shiftAssignments.filters.employeeLabel')}
          value={employeeFilter}
          onChange={(e) => onEmployeeFilterChange(e.target.value)}
          placeholder={t('shiftAssignments.filters.allEmployees')}
          options={employees.map((employee) => ({ label: employee.name || employee.employee_code, value: employee.id }))}
        />
      </div>
      <div className="w-48">
        <DateInput
          id="dateFilter"
          label={t('shiftAssignments.filters.dateLabel')}
          value={dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value)}
        />
      </div>
      <div className="w-40">
        <Select
          label={t('shiftAssignments.filters.statusLabel')}
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          placeholder={t('shiftAssignments.filters.allStatuses')}
          options={[
            { label: t('shiftAssignments.statusActive'), value: 'ACTIVE' },
            { label: t('shiftAssignments.statusCancelled'), value: 'CANCELLED' },
          ]}
        />
      </div>
    </div>
  );
}
