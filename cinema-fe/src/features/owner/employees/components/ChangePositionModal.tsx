import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Employee, Position } from '@/types/entities';
import { groupGrants } from '../permissionLabels';

interface ChangePositionModalProps {
  employee: Employee;
  positions: Position[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (employeeId: number, positionId: number) => void;
}

// Assigning a Position is the only way an employee's permissions change, and the backend is the
// authority on who may do it; this modal only shows the admin what the choice hands out.
export function ChangePositionModal({ employee, positions, isSubmitting, onClose, onSubmit }: ChangePositionModalProps) {
  const { t } = useTranslation('owner');
  const [positionId, setPositionId] = useState<string>(String(employee.position_id));
  const selected = positions.find((p) => String(p.id) === positionId);
  const unchanged = Number(positionId) === employee.position_id;
  const groups = groupGrants(selected?.permissions ?? []);

  return (
    <Modal open onClose={onClose} title={t('employees.changePositionTitle', { name: employee.name || employee.employee_code })}>
      <Select
        label={t('employees.positionLabel')}
        name="position_id"
        value={positionId}
        onChange={(e) => setPositionId(e.target.value)}
        options={positions.map((p) => ({ label: p.name, value: p.id }))}
        placeholder={t('employees.positionPlaceholder')}
      />

      <div className="mt-4">
        <p className="text-sm font-medium text-txt/80">{t('employees.permissionsPreview')}</p>
        {groups.length > 0 ? (
          <ul
            className="mt-2 max-h-60 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10"
            data-testid="position-permissions"
          >
            {groups.map(({ module, actions }) => (
              <li key={module} className="flex items-start justify-between gap-4 px-3 py-2">
                <span className="text-sm font-medium text-txt/90">
                  {t(`employees.permissionModules.${module}`, { defaultValue: module })}
                </span>
                <span className="flex flex-wrap justify-end gap-1.5">
                  {actions.map((action) => (
                    <span key={action} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent">
                      {t(`employees.permissionActions.${action}`, { defaultValue: action })}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-txt/60">{t('employees.noPermissions')}</p>
        )}
        <p className="mt-3 text-xs text-txt/50">{t('employees.permissionsHint')}</p>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('employees.cancel')}
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={isSubmitting}
          disabled={!selected || unchanged}
          onClick={() => selected && onSubmit(employee.id, selected.id)}
        >
          {t('employees.savePosition')}
        </Button>
      </div>
    </Modal>
  );
}
