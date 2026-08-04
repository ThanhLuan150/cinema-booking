import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const verifyCodeMock = vi.fn();
const getAccountsByEmailMock = vi.fn();
const resendCodeMock = vi.fn();
vi.mock('../api/auth.api', () => ({
  verifyCode: (...args: unknown[]) => verifyCodeMock(...args),
  getAccountsByEmail: (...args: unknown[]) => getAccountsByEmailMock(...args),
  resendCode: (...args: unknown[]) => resendCodeMock(...args),
}));

import VerifyCodePage from './VerifyCodePage';

function renderPage(path = '/verifycode?email=a@b.com&role=1') {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/verifycode" element={<VerifyCodePage />} />
          <Route path="/UserInfo" element={<div>User Info Page</div>} />
          <Route path="/CinemaInfo" element={<div>Cinema Info Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VerifyCodePage', () => {
  beforeEach(() => {
    verifyCodeMock.mockReset();
    getAccountsByEmailMock.mockReset();
    resendCodeMock.mockReset();
  });

  it('renders the verification form with 6 code inputs', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Verify Your Account' })).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('0')).toHaveLength(6);
  });

  it('navigates to UserInfo for a regular user on successful verification', async () => {
    verifyCodeMock.mockResolvedValue({ status: 200, data: {} });
    renderPage('/verifycode?email=a@b.com&role=1');
    const inputs = screen.getAllByPlaceholderText('0');
    '123456'.split('').forEach((digit, i) => fireEvent.change(inputs[i], { target: { value: digit } }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('User Info Page')).toBeInTheDocument();
    expect(verifyCodeMock).toHaveBeenCalledWith({ email: 'a@b.com', otp: '123456' });
  });

  it('navigates to CinemaInfo for a theater-owner role', async () => {
    verifyCodeMock.mockResolvedValue({ status: 200, data: {} });
    renderPage('/verifycode?email=a@b.com&role=2');
    const inputs = screen.getAllByPlaceholderText('0');
    '123456'.split('').forEach((digit, i) => fireEvent.change(inputs[i], { target: { value: digit } }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Cinema Info Page')).toBeInTheDocument();
  });

  it('shows an error message when verification fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    verifyCodeMock.mockRejectedValue({ response: { data: { code: 'OTP_INVALID_OR_EXPIRED' } } });
    renderPage();
    const inputs = screen.getAllByPlaceholderText('0');
    '000000'.split('').forEach((digit, i) => fireEvent.change(inputs[i], { target: { value: digit } }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Verification code is invalid or has expired')).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it('resends the code when the resend button is clicked', async () => {
    getAccountsByEmailMock.mockResolvedValue({ data: [{ id: 42 }] });
    resendCodeMock.mockResolvedValue({ status: 200, data: {} });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Resend Code' }));
    await waitFor(() => expect(resendCodeMock).toHaveBeenCalledWith(42));
  });
});
