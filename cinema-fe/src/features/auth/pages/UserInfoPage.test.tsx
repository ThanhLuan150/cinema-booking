import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getAccountByEmailMock = vi.fn();
const saveUserInfoMock = vi.fn();
vi.mock('../api/auth.api', () => ({
  getAccountByEmail: (...args: unknown[]) => getAccountByEmailMock(...args),
  saveUserInfo: (...args: unknown[]) => saveUserInfoMock(...args),
}));

import UserInfoPage from './UserInfoPage';

function renderPage(path = '/UserInfo?email=a@b.com') {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/UserInfo" element={<UserInfoPage />} />
          <Route path="/Login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UserInfoPage', () => {
  beforeEach(() => {
    getAccountByEmailMock.mockReset();
    saveUserInfoMock.mockReset();
    getAccountByEmailMock.mockResolvedValue({ data: { id: 1 } });
  });

  it('renders the form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Your Information' })).toBeInTheDocument();
  });

  it('saves the info and navigates to login on success', async () => {
    saveUserInfoMock.mockResolvedValue({ data: {} });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Type your name'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByPlaceholderText('Type your phone number'), { target: { value: '0912345678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(saveUserInfoMock).toHaveBeenCalledWith({ name: 'Alice', phone: '0912345678', email: 'a@b.com' });
  });

  it('shows an error message when there is no email in the query string', async () => {
    renderPage('/UserInfo');
    fireEvent.change(screen.getByPlaceholderText('Type your name'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByPlaceholderText('Type your phone number'), { target: { value: '0912345678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Account not found. Please try again.')).toBeInTheDocument();
  });
});
