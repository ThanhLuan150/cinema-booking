import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import type { Account } from '@/types/entities';
import { store } from '@/app/store';
import { login, logout } from '@/features/auth/store/authSlice';
import { ROUTES } from '@/constants/routes';
import { RequireRole } from './RequireRole';

function renderProtected(roles: number[]) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/protected']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequireRole roles={roles}>
                <div>Protected Content</div>
              </RequireRole>
            }
          />
          <Route path={ROUTES.login} element={<div>Login Page</div>} />
          <Route path={ROUTES.home} element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('RequireRole', () => {
  beforeEach(() => {
    store.dispatch(logout());
  });

  it('redirects to login when there is no token', () => {
    renderProtected([0]);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to home when the role is not allowed', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: '1', account: {} as Account }));
    renderProtected([0]);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('renders children when the role is allowed', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: '0', account: {} as Account }));
    renderProtected([0]);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
