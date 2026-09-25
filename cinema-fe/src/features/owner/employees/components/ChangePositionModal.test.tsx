import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Employee, Position } from '@/types/entities';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

import { ChangePositionModal } from './ChangePositionModal';

const positions: Position[] = [
  {
    id: 1,
    code: 'USHER',
    name: 'Usher',
    permissions: [
      { code: 'ticket.checkin', scope: 'BRANCH' },
      { code: 'room.read', scope: 'BRANCH' },
    ],
  },
  { id: 2, code: 'CASHIER', name: 'Cashier', permissions: [{ code: 'payment.create', scope: 'BRANCH' }] },
  { id: 3, code: 'CLEANING_STAFF', name: 'Cleaning Staff', permissions: [] },
];

const employee: Employee = {
  id: 9,
  user_id: 20,
  branch_id: 1,
  employee_code: 'EMP-000009',
  position_id: 1,
  hire_date: '2026-01-01',
  status: 1,
  name: 'Alice',
};

function renderModal(onSubmit = vi.fn(), onClose = vi.fn()) {
  render(
    <ChangePositionModal employee={employee} positions={positions} isSubmitting={false} onClose={onClose} onSubmit={onSubmit} />,
  );
  return { onSubmit, onClose };
}

describe('ChangePositionModal', () => {
  it("previews the current position's permissions and keeps Save disabled until the position changes", () => {
    renderModal();
    const list = screen.getByTestId('position-permissions');
    expect(list).toHaveTextContent('employees.permissionModules.ticket');
    expect(list).toHaveTextContent('employees.permissionActions.checkin');
    expect(list).toHaveTextContent('employees.permissionModules.room');
    expect(list).not.toHaveTextContent('ticket.checkin');
    expect(screen.getByRole('button', { name: 'employees.savePosition' })).toBeDisabled();
  });

  it('submits the chosen position id for this employee and shows its permissions', () => {
    const { onSubmit } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Usher/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Cashier' }));

    expect(screen.getByTestId('position-permissions')).toHaveTextContent('employees.permissionModules.payment');
    expect(screen.getByTestId('position-permissions')).not.toHaveTextContent('employees.permissionModules.ticket');

    fireEvent.click(screen.getByRole('button', { name: 'employees.savePosition' }));
    expect(onSubmit).toHaveBeenCalledWith(9, 2);
  });

  it('says so when a position grants nothing extra', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Usher/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Cleaning Staff' }));
    expect(screen.queryByTestId('position-permissions')).not.toBeInTheDocument();
    expect(screen.getByText('employees.noPermissions')).toBeInTheDocument();
  });

  it('cancels without submitting', () => {
    const { onSubmit, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'employees.cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
