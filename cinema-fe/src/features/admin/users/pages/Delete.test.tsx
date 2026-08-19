import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock('@/features/notifications/toast', () => ({
  toast: { success: (...args: unknown[]) => toastSuccessMock(...args), error: (...args: unknown[]) => toastErrorMock(...args) },
}));

const deleteMutate = vi.fn();
vi.mock('../hooks/useDeleteUser', () => ({ useDeleteUser: () => ({ mutateAsync: deleteMutate }) }));

import AdminUsersDelete from './Delete';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/Delete/5']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/Delete/:id" element={<AdminUsersDelete />} />
        <Route path="/ShowUser" element={<div>Users List Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Admin Users Delete', () => {
  beforeEach(() => {
    deleteMutate.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('deletes the user, shows a success toast, and navigates back to the list', async () => {
    deleteMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('users.delete.confirmLabel'));
    expect(await screen.findByText('Users List Page')).toBeInTheDocument();
    expect(deleteMutate).toHaveBeenCalledWith('5');
    expect(toastSuccessMock).toHaveBeenCalledWith('users.delete.toastSuccess');
  });

  it('shows an error toast when deletion fails', async () => {
    deleteMutate.mockRejectedValue(new Error('fail'));
    renderPage();
    fireEvent.click(screen.getByText('users.delete.confirmLabel'));
    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
  });

  it('navigates back without deleting on cancel', () => {
    renderPage();
    fireEvent.click(screen.getByText('actions.cancel'));
    expect(screen.getByText('Users List Page')).toBeInTheDocument();
    expect(deleteMutate).not.toHaveBeenCalled();
  });
});
