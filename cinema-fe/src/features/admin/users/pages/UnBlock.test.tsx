import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock('@/features/notifications/toast', () => ({
  toast: { success: (...args: unknown[]) => toastSuccessMock(...args), error: (...args: unknown[]) => toastErrorMock(...args) },
}));

const useAdminUserByIdMock = vi.fn();
vi.mock('../hooks/useAdminUserById', () => ({ useAdminUserById: (...args: unknown[]) => useAdminUserByIdMock(...args) }));

const unblockMutate = vi.fn();
vi.mock('../hooks/useUnblockUser', () => ({ useUnblockUser: () => ({ mutateAsync: unblockMutate }) }));

import UnblockUser from './UnBlock';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/UnBlockUser/5']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/UnBlockUser/:id" element={<UnblockUser />} />
        <Route path="/ShowUser" element={<div>Users List Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Admin UnblockUser', () => {
  beforeEach(() => {
    useAdminUserByIdMock.mockReset();
    unblockMutate.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    useAdminUserByIdMock.mockReturnValue({ data: { id: 5, name: 'Alice' } });
  });

  it('unblocks the user with status 1, shows a success toast, and navigates back', async () => {
    unblockMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('users.unblock.confirmLabel'));
    expect(await screen.findByText('Users List Page')).toBeInTheDocument();
    expect(unblockMutate).toHaveBeenCalledWith({ id: '5', status: 1 });
    expect(toastSuccessMock).toHaveBeenCalledWith('users.unblock.toastSuccess');
  });

  it('shows an error toast when unblocking fails', async () => {
    unblockMutate.mockRejectedValue(new Error('fail'));
    renderPage();
    fireEvent.click(screen.getByText('users.unblock.confirmLabel'));
    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
  });
});
