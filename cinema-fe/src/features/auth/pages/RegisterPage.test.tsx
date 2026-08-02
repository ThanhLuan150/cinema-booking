import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/authSlice';

const checkEmailExistsMock = vi.fn();
const registerMock = vi.fn();
vi.mock('../api/auth.api', () => ({
  checkEmailExists: (...args: unknown[]) => checkEmailExistsMock(...args),
  register: (...args: unknown[]) => registerMock(...args),
}));

import RegisterPage from './RegisterPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter initialEntries={['/Register']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/Register" element={<RegisterPage />} />
            <Route path="/verifycode" element={<div>Verify Code Page</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    checkEmailExistsMock.mockReset();
    registerMock.mockReset();
  });

  it('renders the register form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('shows a field error when the email already exists', async () => {
    checkEmailExistsMock.mockResolvedValue({ data: { exists: true } });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Type your email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Type your password'), { target: { value: 'Password1!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Email already exists')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('registers and navigates to verify-code on success', async () => {
    checkEmailExistsMock.mockResolvedValue({ data: { exists: false } });
    registerMock.mockResolvedValue({ data: {} });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Type your email'), { target: { value: 'new@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Type your password'), { target: { value: 'Password1!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Verify Code Page')).toBeInTheDocument();
  });
});
