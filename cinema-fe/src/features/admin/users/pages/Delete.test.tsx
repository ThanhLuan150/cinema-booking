import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const swalFireMock = vi.fn();
vi.mock('sweetalert2', () => ({ default: { fire: (...args: unknown[]) => swalFireMock(...args) } }));

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
    swalFireMock.mockReset();
  });

  it('deletes the user and navigates back to the list', async () => {
    deleteMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('users.delete.confirmLabel'));
    expect(await screen.findByText('Users List Page')).toBeInTheDocument();
    expect(deleteMutate).toHaveBeenCalledWith('5');
  });

  it('navigates back without deleting on cancel', () => {
    renderPage();
    fireEvent.click(screen.getByText('actions.cancel'));
    expect(screen.getByText('Users List Page')).toBeInTheDocument();
    expect(deleteMutate).not.toHaveBeenCalled();
  });
});
