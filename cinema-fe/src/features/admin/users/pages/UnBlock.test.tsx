import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const swalFireMock = vi.fn();
vi.mock('sweetalert2', () => ({ default: { fire: (...args: unknown[]) => swalFireMock(...args) } }));

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
    swalFireMock.mockReset();
    useAdminUserByIdMock.mockReturnValue({ data: { id: 5, name: 'Alice' } });
  });

  it('unblocks the user with status 1 and navigates back', async () => {
    unblockMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('users.unblock.confirmLabel'));
    expect(await screen.findByText('Users List Page')).toBeInTheDocument();
    expect(unblockMutate).toHaveBeenCalledWith({ id: '5', status: 1 });
  });
});
