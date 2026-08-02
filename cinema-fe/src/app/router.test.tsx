import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { login, logout } from '@/features/auth/store/authSlice';
import type { Account } from '@/types/entities';
import { ROUTES } from '@/constants/routes';
import { ROLES } from '@/constants/roles';

vi.mock('@/features/home/pages/HomePage', () => ({ default: () => <div>Home</div> }));
vi.mock('@/features/movie-detail/pages/MovieDetailPage', () => ({ default: () => <div>Detail</div> }));
vi.mock('@/features/cinema-detail/pages/CinemaDetailPage', () => ({ default: () => <div>CinemaDetail</div> }));
vi.mock('@/features/auth/pages/RegisterPage', () => ({ default: () => <div>Register</div> }));
vi.mock('@/features/auth/pages/LoginPage', () => ({ default: () => <div>LoginForm</div> }));
vi.mock('@/features/auth/pages/VerifyCodePage', () => ({ default: () => <div>VerifyCode</div> }));
vi.mock('@/features/auth/pages/UserInfoPage', () => ({ default: () => <div>UserInfo</div> }));
vi.mock('@/features/auth/pages/CinemaInfoPage', () => ({ default: () => <div>CinemaInfo</div> }));
vi.mock('@/features/auth/pages/ProfilePage', () => ({ default: () => <div>Profile</div> }));
vi.mock('@/features/auth/pages/ForgotPasswordPage', () => ({ default: () => <div>ForgotPassword</div> }));
vi.mock('@/features/auth/pages/ResetPasswordPage', () => ({ default: () => <div>ResetPassword</div> }));
vi.mock('@/features/auth/pages/ChangePasswordPage', () => ({ default: () => <div>ChangePassword</div> }));
vi.mock('@/features/booking/pages/MyBookingsPage', () => ({ default: () => <div>MyBookings</div> }));
vi.mock('@/features/admin/users/pages/List', () => ({ default: () => <div>ShowUser</div> }));
vi.mock('@/features/admin/users/pages/Delete', () => ({ default: () => <div>UserDelete</div> }));
vi.mock('@/features/admin/users/pages/Block', () => ({ default: () => <div>BlockUser</div> }));
vi.mock('@/features/admin/users/pages/UnBlock', () => ({ default: () => <div>UnblockUser</div> }));
vi.mock('@/features/admin/movies/pages/List', () => ({ default: () => <div>Show</div> }));
vi.mock('@/features/admin/schedules/pages/List', () => ({ default: () => <div>ShowSchedule</div> }));
vi.mock('@/features/owner/pages/OwnerDashboard', () => ({ default: () => <div>OwnerDashboard</div> }));
vi.mock('@/features/owner/cinemas/pages/List', () => ({ default: () => <div>OwnerCinemas</div> }));
vi.mock('@/features/owner/cinemas/pages/Rooms', () => ({ default: () => <div>OwnerRooms</div> }));
vi.mock('@/features/owner/combos/pages/List', () => ({ default: () => <div>OwnerCombos</div> }));
vi.mock('@/features/owner/vouchers/pages/List', () => ({ default: () => <div>OwnerVouchers</div> }));
vi.mock('@/features/owner/pages/Lookup', () => ({ default: () => <div>OwnerBookingLookup</div> }));
vi.mock('@/features/admin/dashboard/pages/AdminDashboard', () => ({ default: () => <div>AdminDashboard</div> }));
vi.mock('@/features/admin/cinemas/pages/List', () => ({ default: () => <div>AdminCinemas</div> }));
vi.mock('@/features/admin/transactions/pages/List', () => ({ default: () => <div>AdminTransactions</div> }));
vi.mock('@/features/admin/reviews/pages/List', () => ({ default: () => <div>AdminReviews</div> }));
vi.mock('@/features/movies/pages/Upcoming', () => ({ default: () => <div>Upcoming</div> }));
vi.mock('@/features/movies/pages/Playing', () => ({ default: () => <div>Playing</div> }));
vi.mock('@/features/movies/pages/Cinemas', () => ({ default: () => <div>Cinemas</div> }));
vi.mock('@/features/booking/pages/BookTicketPage', () => ({ default: () => <div>BookTicket</div> }));
vi.mock('@/features/booking/pages/BookSeatPage', () => ({ default: () => <div>BookSeat</div> }));
vi.mock('@/features/booking/pages/PaymentResultPage', () => ({ default: () => <div>PaymentResult</div> }));

import { AppRouter } from './router';

function renderAt(path: string) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRouter />
      </MemoryRouter>
    </Provider>,
  );
}

describe('AppRouter', () => {
  beforeEach(() => {
    store.dispatch(logout());
  });

  it('renders the public home route', () => {
    renderAt(ROUTES.home);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders a public route without any guard', () => {
    renderAt(ROUTES.playing);
    expect(screen.getByText('Playing')).toBeInTheDocument();
  });

  it('redirects an admin-only route to login when unauthenticated', () => {
    renderAt(ROUTES.adminUsers);
    expect(screen.getByText('LoginForm')).toBeInTheDocument();
  });

  it('renders an admin-only route when logged in as an admin', () => {
    store.dispatch(login({ token: 'tok', userId: '1', role: String(ROLES.admin), account: {} as Account }));
    renderAt(ROUTES.adminUsers);
    expect(screen.getByText('ShowUser')).toBeInTheDocument();
  });

  it('redirects an admin-only route to home when logged in as a non-admin', () => {
    store.dispatch(login({ token: 'tok', userId: '1', role: String(ROLES.customer), account: {} as Account }));
    renderAt(ROUTES.adminUsers);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders an owner-management route when logged in as an owner', () => {
    store.dispatch(login({ token: 'tok', userId: '1', role: String(ROLES.owner), account: {} as Account }));
    renderAt(ROUTES.ownerCinemas);
    expect(screen.getByText('OwnerCinemas')).toBeInTheDocument();
  });

  it('renders an owner-management route when logged in as an admin (shared management role)', () => {
    store.dispatch(login({ token: 'tok', userId: '1', role: String(ROLES.admin), account: {} as Account }));
    renderAt(ROUTES.ownerDashboard);
    expect(screen.getByText('OwnerDashboard')).toBeInTheDocument();
  });

  it('redirects an owner-management route to login when unauthenticated', () => {
    renderAt(ROUTES.ownerVouchers);
    expect(screen.getByText('LoginForm')).toBeInTheDocument();
  });
});
