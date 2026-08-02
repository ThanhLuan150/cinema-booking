import '@/i18n';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const resetPasswordMock = vi.fn();
vi.mock('../api/auth.api', () => ({ resetPassword: (...args: unknown[]) => resetPasswordMock(...args) }));

import ResetPasswordPage from './ResetPasswordPage';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/ResetPassword']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/ResetPassword" element={<ResetPasswordPage />} />
          <Route path="/Login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ResetPasswordPage', () => {
  it('renders the form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
  });

  it('navigates to login on success', async () => {
    resetPasswordMock.mockResolvedValue({ data: {} });
    renderPage();
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('shows a server error on failure', async () => {
    resetPasswordMock.mockRejectedValue({ response: { data: { code: 'OTP_INVALID_OR_EXPIRED' } } });
    renderPage();
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '000000' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    expect(await screen.findByText('Verification code is invalid or has expired')).toBeInTheDocument();
  });
});
