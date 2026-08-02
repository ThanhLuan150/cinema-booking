import '@/i18n';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const forgotPasswordMock = vi.fn();
vi.mock('../api/auth.api', () => ({ forgotPassword: (...args: unknown[]) => forgotPasswordMock(...args) }));

import ForgotPasswordPage from './ForgotPasswordPage';

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/ForgotPassword']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/ForgotPassword" element={<ForgotPasswordPage />} />
          <Route path="/ResetPassword" element={<div>Reset Password Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ForgotPasswordPage', () => {
  it('renders the form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Forgot Password' })).toBeInTheDocument();
  });

  it('navigates to reset-password on success', async () => {
    forgotPasswordMock.mockResolvedValue({ data: {} });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Type your email'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
    expect(await screen.findByText('Reset Password Page')).toBeInTheDocument();
  });

  it('shows a field error on failure', async () => {
    forgotPasswordMock.mockRejectedValue({ response: { data: { code: 'ACCOUNT_NOT_FOUND' } } });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Type your email'), { target: { value: 'nobody@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
    expect(await screen.findByText('Account does not exist')).toBeInTheDocument();
  });
});
