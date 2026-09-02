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
vi.mock('@/features/owner/maintenance/pages/List', () => ({ default: () => <div>OwnerMaintenance</div> }));
vi.mock('@/features/owner/combos/pages/List', () => ({ default: () => <div>OwnerCombos</div> }));
vi.mock('@/features/owner/vouchers/pages/List', () => ({ default: () => <div>OwnerVouchers</div> }));
vi.mock('@/features/owner/promotions/pages/List', () => ({ default: () => <div>OwnerPromotions</div> }));
vi.mock('@/features/owner/pricingRules/pages/List', () => ({ default: () => <div>OwnerPricingRules</div> }));
vi.mock('@/features/owner/holidays/pages/List', () => ({ default: () => <div>OwnerHolidays</div> }));
vi.mock('@/features/owner/pages/Lookup', () => ({ default: () => <div>OwnerBookingLookup</div> }));
vi.mock('@/features/owner/employees/pages/List', () => ({ default: () => <div>OwnerEmployees</div> }));
vi.mock('@/features/employee/pages/EmployeeDashboard', () => ({ default: () => <div>EmployeeDashboard</div> }));
vi.mock('@/features/employee/pages/CounterSale', () => ({ default: () => <div>EmployeeCounterSale</div> }));
vi.mock('@/features/employee/pages/BoxOffice', () => ({ default: () => <div>EmployeeBoxOffice</div> }));
vi.mock('@/features/employee/pages/CheckIn', () => ({ default: () => <div>EmployeeCheckIn</div> }));
vi.mock('@/features/booking/pages/BookingManagementPage', () => ({ default: () => <div>BookingManagement</div> }));
vi.mock('@/features/admin/actors/pages/List', () => ({ default: () => <div>AdminActors</div> }));
vi.mock('@/features/admin/directors/pages/List', () => ({ default: () => <div>AdminDirectors</div> }));
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
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.admin), account: {} as Account }));
    renderAt(ROUTES.adminUsers);
    expect(screen.getByText('ShowUser')).toBeInTheDocument();
  });

  it('redirects an admin-only route to home when logged in as a non-admin', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.customer), account: {} as Account }));
    renderAt(ROUTES.adminUsers);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders an owner-management route when logged in as an owner', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.owner), account: {} as Account }));
    renderAt(ROUTES.ownerCinemas);
    expect(screen.getByText('OwnerCinemas')).toBeInTheDocument();
  });

  it('renders an owner-management route when logged in as an admin (shared management role)', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.admin), account: {} as Account }));
    renderAt(ROUTES.ownerDashboard);
    expect(screen.getByText('OwnerDashboard')).toBeInTheDocument();
  });

  it('redirects an owner-management route to login when unauthenticated', () => {
    renderAt(ROUTES.ownerVouchers);
    expect(screen.getByText('LoginForm')).toBeInTheDocument();
  });

  it('renders the owner promotions route when logged in as an owner', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.owner), account: {} as Account }));
    renderAt(ROUTES.ownerPromotions);
    expect(screen.getByText('OwnerPromotions')).toBeInTheDocument();
  });

  it('renders the owner pricing rules route when logged in as an owner', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.owner), account: {} as Account }));
    renderAt(ROUTES.ownerPricingRules);
    expect(screen.getByText('OwnerPricingRules')).toBeInTheDocument();
  });

  it('renders the owner holidays route when logged in as an owner', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.owner), account: {} as Account }));
    renderAt(ROUTES.ownerHolidays);
    expect(screen.getByText('OwnerHolidays')).toBeInTheDocument();
  });

  it('renders the owner employees route when logged in as an owner', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.owner), account: {} as Account }));
    renderAt(ROUTES.ownerEmployees);
    expect(screen.getByText('OwnerEmployees')).toBeInTheDocument();
  });

  it('renders the maintenance route when logged in as an owner', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.owner), account: {} as Account }));
    renderAt(ROUTES.ownerMaintenance);
    expect(screen.getByText('OwnerMaintenance')).toBeInTheDocument();
  });

  it('renders the maintenance route when logged in as an employee (staff-wide route)', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.employee), account: {} as Account }));
    renderAt(ROUTES.ownerMaintenance);
    expect(screen.getByText('OwnerMaintenance')).toBeInTheDocument();
  });

  it('redirects an admin away from home to the admin dashboard', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.admin), account: {} as Account }));
    renderAt(ROUTES.home);
    expect(screen.getByText('AdminDashboard')).toBeInTheDocument();
  });

  it('redirects an owner away from home to the owner dashboard', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.owner), account: {} as Account }));
    renderAt(ROUTES.home);
    expect(screen.getByText('OwnerDashboard')).toBeInTheDocument();
  });

  it('renders home for a logged-in customer', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.customer), account: {} as Account }));
    renderAt(ROUTES.home);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('redirects an employee away from home to the employee dashboard', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.employee), account: {} as Account }));
    renderAt(ROUTES.home);
    expect(screen.getByText('EmployeeDashboard')).toBeInTheDocument();
  });

  it('renders the employee dashboard route for an employee but not for a customer', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.employee), account: {} as Account }));
    renderAt(ROUTES.employeeDashboard);
    expect(screen.getByText('EmployeeDashboard')).toBeInTheDocument();
  });

  it('redirects a customer away from the employee dashboard route', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.customer), account: {} as Account }));
    renderAt(ROUTES.employeeDashboard);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders the admin actors route for an admin', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.admin), account: {} as Account }));
    renderAt(ROUTES.adminActors);
    expect(screen.getByText('AdminActors')).toBeInTheDocument();
  });

  it('redirects a non-admin away from the admin directors route', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.owner), account: {} as Account }));
    renderAt(ROUTES.adminDirectors);
    expect(screen.getByText('OwnerDashboard')).toBeInTheDocument();
  });

  it('allows an owner (staff role) onto the counter-sale route', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.owner), account: {} as Account }));
    renderAt(ROUTES.employeeCounterSale);
    expect(screen.getByText('EmployeeCounterSale')).toBeInTheDocument();
  });

  it('allows any staff role onto the box office route', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.employee), account: {} as Account }));
    renderAt(ROUTES.employeeBoxOffice);
    expect(screen.getByText('EmployeeBoxOffice')).toBeInTheDocument();
  });

  it('redirects a customer away from the box office route', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.customer), account: {} as Account }));
    renderAt(ROUTES.employeeBoxOffice);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('allows any staff role onto the shared booking management route', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.employee), account: {} as Account }));
    renderAt(ROUTES.bookingManagement);
    expect(screen.getByText('BookingManagement')).toBeInTheDocument();
  });

  it('redirects a customer away from the booking management route', () => {
    store.dispatch(login({ accessToken: 'tok', userId: '1', role: String(ROLES.customer), account: {} as Account }));
    renderAt(ROUTES.bookingManagement);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});
