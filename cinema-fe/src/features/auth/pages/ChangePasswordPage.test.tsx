import '@/i18n';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/authSlice';

const changePasswordMock = vi.fn();
vi.mock('../api/auth.api', () => ({ changePassword: (...args: unknown[]) => changePasswordMock(...args) }));

vi.mock('../hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

import ChangePasswordPage from './ChangePasswordPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ChangePasswordPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('ChangePasswordPage', () => {
  it('renders the form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
  });

  it('clears the form after a successful change', async () => {
    changePasswordMock.mockResolvedValue({ data: {} });
    renderPage();
    const current = screen.getByLabelText('Current Password') as HTMLInputElement;
    const next = screen.getByLabelText('New Password') as HTMLInputElement;
    const confirm = screen.getByLabelText('Confirm New Password') as HTMLInputElement;
    fireEvent.change(current, { target: { value: 'OldPass1!' } });
    fireEvent.change(next, { target: { value: 'NewPass1!' } });
    fireEvent.change(confirm, { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => expect(changePasswordMock).toHaveBeenCalledWith({
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
      c_password: 'NewPass1!',
    }));
    await waitFor(() => expect(current.value).toBe(''));
  });

  it('shows a server error on failure', async () => {
    changePasswordMock.mockRejectedValue({ response: { data: { code: 'CURRENT_PASSWORD_INVALID' } } });
    renderPage();
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'Wrong1!' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
  });
});
