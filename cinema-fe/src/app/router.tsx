import { Routes, Route } from 'react-router-dom';
import { ADMIN_ONLY_ROLES, MANAGEMENT_ROLES, EMPLOYEE_ONLY_ROLES, STAFF_ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { RequireRole } from './RequireRole';
import { RedirectManagementFromHome } from './RedirectManagementFromHome';
import Home from '@/features/home/pages/HomePage';
import Detail from '@/features/movie-detail/pages/MovieDetailPage';
import CinemaDetail from '@/features/cinema-detail/pages/CinemaDetailPage';
import Register from '@/features/auth/pages/RegisterPage';
import LoginForm from '@/features/auth/pages/LoginPage';
import VerifyCode from '@/features/auth/pages/VerifyCodePage';
import UserInfo from '@/features/auth/pages/UserInfoPage';
import Profile from '@/features/auth/pages/ProfilePage';
import ForgotPassword from '@/features/auth/pages/ForgotPasswordPage';
import ResetPassword from '@/features/auth/pages/ResetPasswordPage';
import ChangePassword from '@/features/auth/pages/ChangePasswordPage';
import MyBookings from '@/features/booking/pages/MyBookingsPage';
import ShowUser from '@/features/admin/users/pages/List';
import UserDelete from '@/features/admin/users/pages/Delete';
import BlockUser from '@/features/admin/users/pages/Block';
import UnblockUser from '@/features/admin/users/pages/UnBlock';
import Show from '@/features/admin/movies/pages/List';
import ShowSchedule from '@/features/admin/schedules/pages/List';
import OwnerDashboard from '@/features/owner/pages/OwnerDashboard';
import OwnerCinemas from '@/features/owner/cinemas/pages/List';
import OwnerRooms from '@/features/owner/cinemas/pages/Rooms';
import OwnerCombos from '@/features/owner/combos/pages/List';
import OwnerVouchers from '@/features/owner/vouchers/pages/List';
import OwnerBookingLookup from '@/features/owner/pages/Lookup';
import OwnerEmployees from '@/features/owner/employees/pages/List';
import OwnerShifts from '@/features/owner/shifts/pages/List';
import OwnerShiftAssignments from '@/features/owner/shifts/pages/Assignments';
import AdminActors from '@/features/admin/actors/pages/List';
import AdminDirectors from '@/features/admin/directors/pages/List';
import EmployeeDashboard from '@/features/employee/pages/EmployeeDashboard';
import EmployeeCounterSale from '@/features/employee/pages/CounterSale';
import EmployeeCheckIn from '@/features/employee/pages/CheckIn';
import EmployeeMySchedule from '@/features/employee/pages/MySchedule';
import AdminDashboard from '@/features/admin/dashboard/pages/AdminDashboard';
import AdminCinemas from '@/features/admin/cinemas/pages/List';
import AdminTransactions from '@/features/admin/transactions/pages/List';
import AdminReviews from '@/features/admin/reviews/pages/List';
import Upcoming from '@/features/movies/pages/Upcoming';
import Playing from '@/features/movies/pages/Playing';
import Cinemas from '@/features/movies/pages/Cinemas';
import BookTicket from '@/features/booking/pages/BookTicketPage';
import BookSeat from '@/features/booking/pages/BookSeatPage';
import PaymentResult from '@/features/booking/pages/PaymentResultPage';
import About from '@/features/static/pages/AboutPage';
import Faq from '@/features/static/pages/FaqPage';
import Contact from '@/features/static/pages/ContactPage';

export function AppRouter() {
  return (
    <Routes>
      <Route
        path={ROUTES.home}
        element={
          <RedirectManagementFromHome>
            <Home />
          </RedirectManagementFromHome>
        }
      />
      <Route path="/Detail/:id" element={<Detail />} />
      <Route path="/Cinema/:id" element={<CinemaDetail />} />
      <Route path={ROUTES.register} element={<Register />} />
      <Route path={ROUTES.login} element={<LoginForm />} />
      <Route path={ROUTES.verifyCode} element={<VerifyCode />} />
      <Route path={ROUTES.userInfo} element={<UserInfo />} />
      <Route path={ROUTES.profile} element={<Profile />} />
      <Route path={ROUTES.forgotPassword} element={<ForgotPassword />} />
      <Route path={ROUTES.resetPassword} element={<ResetPassword />} />
      <Route path={ROUTES.changePassword} element={<ChangePassword />} />
      <Route path={ROUTES.myBookings} element={<MyBookings />} />
      <Route
        path={ROUTES.adminUsers}
        element={
          <RequireRole roles={ADMIN_ONLY_ROLES}>
            <ShowUser />
          </RequireRole>
        }
      />
      <Route
        path="/Delete/:id"
        element={
          <RequireRole roles={ADMIN_ONLY_ROLES}>
            <UserDelete />
          </RequireRole>
        }
      />
      <Route
        path="/BlockUser/:id"
        element={
          <RequireRole roles={ADMIN_ONLY_ROLES}>
            <BlockUser />
          </RequireRole>
        }
      />
      <Route
        path="/UnBlockUser/:id"
        element={
          <RequireRole roles={ADMIN_ONLY_ROLES}>
            <UnblockUser />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.adminMovies}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <Show />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.adminSchedules}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <ShowSchedule />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.ownerDashboard}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <OwnerDashboard />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.ownerCinemas}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <OwnerCinemas />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.ownerRooms}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <OwnerRooms />
          </RequireRole>
        }
      />
      <Route
        path="/OwnerCinemas/:branchId/Rooms"
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <OwnerRooms />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.ownerCombos}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <OwnerCombos />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.ownerVouchers}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <OwnerVouchers />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.ownerBookings}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <OwnerBookingLookup />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.ownerEmployees}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <OwnerEmployees />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.ownerShifts}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <OwnerShifts />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.ownerShiftAssignments}
        element={
          <RequireRole roles={MANAGEMENT_ROLES}>
            <OwnerShiftAssignments />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.employeeDashboard}
        element={
          <RequireRole roles={EMPLOYEE_ONLY_ROLES}>
            <EmployeeDashboard />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.employeeMySchedule}
        element={
          <RequireRole roles={EMPLOYEE_ONLY_ROLES}>
            <EmployeeMySchedule />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.employeeCounterSale}
        element={
          <RequireRole roles={STAFF_ROLES}>
            <EmployeeCounterSale />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.employeeCheckIn}
        element={
          <RequireRole roles={STAFF_ROLES}>
            <EmployeeCheckIn />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.adminActors}
        element={
          <RequireRole roles={ADMIN_ONLY_ROLES}>
            <AdminActors />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.adminDirectors}
        element={
          <RequireRole roles={ADMIN_ONLY_ROLES}>
            <AdminDirectors />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.adminDashboard}
        element={
          <RequireRole roles={ADMIN_ONLY_ROLES}>
            <AdminDashboard />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.adminCinemas}
        element={
          <RequireRole roles={ADMIN_ONLY_ROLES}>
            <AdminCinemas />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.adminTransactions}
        element={
          <RequireRole roles={ADMIN_ONLY_ROLES}>
            <AdminTransactions />
          </RequireRole>
        }
      />
      <Route
        path={ROUTES.adminReviews}
        element={
          <RequireRole roles={ADMIN_ONLY_ROLES}>
            <AdminReviews />
          </RequireRole>
        }
      />
      <Route path={ROUTES.upcoming} element={<Upcoming />} />
      <Route path={ROUTES.playing} element={<Playing />} />
      <Route path={ROUTES.cinemas} element={<Cinemas />} />
      <Route path={ROUTES.about} element={<About />} />
      <Route path={ROUTES.faq} element={<Faq />} />
      <Route path={ROUTES.contact} element={<Contact />} />
      <Route path={ROUTES.bookSeat} element={<BookSeat />} />
      <Route path="/BookTicket/:id" element={<BookTicket />} />
      <Route path={ROUTES.paymentResult} element={<PaymentResult />} />
    </Routes>
  );
}
