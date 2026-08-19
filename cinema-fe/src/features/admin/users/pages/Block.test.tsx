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

const blockMutate = vi.fn();
vi.mock('../hooks/useBlockUser', () => ({ useBlockUser: () => ({ mutateAsync: blockMutate }) }));

import BlockUser from './Block';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/BlockUser/5']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/BlockUser/:id" element={<BlockUser />} />
        <Route path="/ShowUser" element={<div>Users List Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Admin BlockUser', () => {
  beforeEach(() => {
    useAdminUserByIdMock.mockReset();
    blockMutate.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    useAdminUserByIdMock.mockReturnValue({ data: { id: 5, name: 'Alice' } });
  });

  it('renders the confirm dialog with the user name', () => {
    renderPage();
    expect(screen.getByText('users.block.confirmTitle')).toBeInTheDocument();
  });

  it('blocks the user, shows a success toast, and navigates back to the list on confirm', async () => {
    blockMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('users.block.confirmLabel'));
    expect(await screen.findByText('Users List Page')).toBeInTheDocument();
    expect(blockMutate).toHaveBeenCalledWith('5');
    expect(toastSuccessMock).toHaveBeenCalledWith('users.block.toastSuccess');
  });

  it('shows an error toast when blocking fails', async () => {
    blockMutate.mockRejectedValue(new Error('fail'));
    renderPage();
    fireEvent.click(screen.getByText('users.block.confirmLabel'));
    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
  });

  it('navigates back without blocking on cancel', () => {
    renderPage();
    fireEvent.click(screen.getByText('actions.cancel'));
    expect(screen.getByText('Users List Page')).toBeInTheDocument();
    expect(blockMutate).not.toHaveBeenCalled();
  });
});
