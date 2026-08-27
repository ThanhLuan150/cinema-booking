import { ReactNode, useState } from 'react';
import { useNavigate, NavLink, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useAppDispatch } from '@/hooks/redux';
import { logout } from '@/features/auth/store/authSlice';
import { logout as logoutApi } from '@/features/auth/api/auth.api';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/features/notifications/toast';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { Avatar } from '@/components/ui/Avatar';
import { ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';

export interface AdminLayoutProps {
  breadcrumb: string;
  children: ReactNode;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent/15 text-accent shadow-[inset_2px_0_0_0_theme(colors.accent.DEFAULT)]'
      : 'text-txt/70 hover:bg-white/5 hover:text-txt',
  );

export function AdminLayout({ breadcrumb, children }: AdminLayoutProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const { hasPermission } = usePermissions();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isAdmin = user?.role === ROLES.admin;
  const isEmployee = user?.role === ROLES.employee;
  const dashboardRoute = isAdmin ? ROUTES.adminDashboard : isEmployee ? ROUTES.employeeDashboard : ROUTES.ownerDashboard;
  const displayName = user?.name || t('adminLayout.adminFallback');

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logoutApi().catch(() => { });
    dispatch(logout());
    queryClient.clear();
    toast.success(t('header.logoutSuccess'));
    navigate(ROUTES.login);
  };

  return (
    <div className="flex min-h-screen flex-col bg-main font-sans lg:flex-row">
      <div className="flex w-full shrink-0 flex-col border-b border-border bg-surface px-4 py-6 lg:w-64 lg:border-b-0 lg:border-r">
        <Link to={dashboardRoute} className="flex items-center gap-2 px-2 no-underline">
          <i className="fa-solid fa-film text-lg text-accent" aria-hidden="true" />
          <b className="font-script text-2xl leading-none text-txt">
            {t('brand')}
            <span className="text-accent">.</span>
          </b>
        </Link>
        <nav className="mt-8 flex flex-col gap-1 text-sm">
          <NavLink to={dashboardRoute} className={navLinkClass}>
            <ion-icon name="stats-chart" />
            {t('adminLayout.nav.dashboard')}
          </NavLink>
          {isEmployee ? (
            <>
              {hasPermission('booking.create') && (
                <NavLink to={ROUTES.employeeCounterSale} className={navLinkClass}>
                  <ion-icon name="cart" />
                  {t('adminLayout.nav.counterSale')}
                </NavLink>
              )}
              {hasPermission('ticket.checkin') && (
                <NavLink to={ROUTES.employeeCheckIn} className={navLinkClass}>
                  <ion-icon name="qr-code" />
                  {t('adminLayout.nav.checkIn')}
                </NavLink>
              )}
              {hasPermission('booking.read') && (
                <NavLink to={ROUTES.bookingManagement} className={navLinkClass}>
                  <ion-icon name="receipt" />
                  {t('adminLayout.nav.bookingManagement')}
                </NavLink>
              )}
              {hasPermission('combo.order.view') && (
                <NavLink to={ROUTES.comboOrders} className={navLinkClass}>
                  <ion-icon name="fast-food" />
                  {t('adminLayout.nav.comboOrders')}
                </NavLink>
              )}
              {hasPermission('maintenance.read') && (
                <NavLink to={ROUTES.ownerMaintenance} className={navLinkClass}>
                  <ion-icon name="construct" />
                  {t('adminLayout.nav.maintenance')}
                </NavLink>
              )}
              {hasPermission('refund.read') && (
                <NavLink to={ROUTES.refundManagement} className={navLinkClass}>
                  <ion-icon name="cash-outline" />
                  {t('adminLayout.nav.refunds')}
                </NavLink>
              )}
              {hasPermission('supportTicket.read') && (
                <NavLink to={ROUTES.supportTickets} className={navLinkClass}>
                  <ion-icon name="headset" />
                  {t('adminLayout.nav.supportTickets')}
                </NavLink>
              )}
              <NavLink to={ROUTES.employeeMySchedule} className={navLinkClass}>
                <ion-icon name="calendar" />
                {t('adminLayout.nav.mySchedule')}
              </NavLink>
            </>
          ) : (
            <>
              {isAdmin && (
                <NavLink to={ROUTES.adminUsers} className={navLinkClass}>
                  <ion-icon name="person" />
                  {t('adminLayout.nav.user')}
                </NavLink>
              )}
              <NavLink to={ROUTES.adminMovies} className={navLinkClass}>
                <ion-icon name="play-circle" />
                {t('adminLayout.nav.films')}
              </NavLink>
              <NavLink to={ROUTES.adminSchedules} className={navLinkClass}>
                <i className="fa-solid fa-calendar-days w-[1.125rem] text-center" />
                {t('adminLayout.nav.schedule')}
              </NavLink>
              <NavLink to={isAdmin ? ROUTES.adminCinemas : ROUTES.ownerCinemas} className={navLinkClass}>
                <ion-icon name="business" />
                {t('adminLayout.nav.cinemas')}
              </NavLink>
              <NavLink to={ROUTES.ownerRooms} className={navLinkClass}>
                <ion-icon name="grid" />
                {t('adminLayout.nav.rooms')}
              </NavLink>
              <NavLink to={ROUTES.ownerMaintenance} className={navLinkClass}>
                <ion-icon name="construct" />
                {t('adminLayout.nav.maintenance')}
              </NavLink>
              {hasPermission('device.read') && (
                <NavLink to={ROUTES.ownerDevices} className={navLinkClass}>
                  <ion-icon name="scan" />
                  {t('adminLayout.nav.devices')}
                </NavLink>
              )}
              <NavLink to={ROUTES.ownerCombos} className={navLinkClass}>
                <ion-icon name="fast-food" />
                {t('adminLayout.nav.combos')}
              </NavLink>
              {hasPermission('inventory.view') && (
                <NavLink to={ROUTES.ownerInventory} className={navLinkClass}>
                  <ion-icon name="cube" />
                  {t('adminLayout.nav.inventory')}
                </NavLink>
              )}
              <NavLink to={ROUTES.ownerVouchers} className={navLinkClass}>
                <ion-icon name="pricetag" />
                {t('adminLayout.nav.vouchers')}
              </NavLink>
              <NavLink to={ROUTES.ownerPromotions} className={navLinkClass}>
                <ion-icon name="megaphone" />
                {t('adminLayout.nav.promotions')}
              </NavLink>
              <NavLink to={ROUTES.ownerPricingRules} className={navLinkClass}>
                <ion-icon name="cash" />
                {t('adminLayout.nav.pricingRules')}
              </NavLink>
              <NavLink to={ROUTES.ownerHolidays} className={navLinkClass}>
                <ion-icon name="flag" />
                {t('adminLayout.nav.holidays')}
              </NavLink>
              <NavLink to={ROUTES.ownerBookings} className={navLinkClass}>
                <ion-icon name="qr-code" />
                {t('adminLayout.nav.bookings')}
              </NavLink>
              {hasPermission('booking.read') && (
                <NavLink to={ROUTES.bookingManagement} className={navLinkClass}>
                  <ion-icon name="receipt" />
                  {t('adminLayout.nav.bookingManagement')}
                </NavLink>
              )}
              {hasPermission('refund.read') && (
                <NavLink to={ROUTES.refundManagement} className={navLinkClass}>
                  <ion-icon name="cash-outline" />
                  {t('adminLayout.nav.refunds')}
                </NavLink>
              )}
              {hasPermission('supportTicket.read') && (
                <NavLink to={ROUTES.supportTickets} className={navLinkClass}>
                  <ion-icon name="headset" />
                  {t('adminLayout.nav.supportTickets')}
                </NavLink>
              )}
              {hasPermission('combo.order.view') && (
                <NavLink to={ROUTES.comboOrders} className={navLinkClass}>
                  <ion-icon name="fast-food-outline" />
                  {t('adminLayout.nav.comboOrders')}
                </NavLink>
              )}
              <NavLink to={ROUTES.ownerEmployees} className={navLinkClass}>
                <ion-icon name="people" />
                {t('adminLayout.nav.employees')}
              </NavLink>
              <NavLink to={ROUTES.ownerShifts} className={navLinkClass}>
                <ion-icon name="time" />
                {t('adminLayout.nav.shifts')}
              </NavLink>
              {hasPermission('auditLog.read') && (
                <NavLink to={ROUTES.auditLog} className={navLinkClass}>
                  <ion-icon name="document-lock" />
                  {t('adminLayout.nav.auditLog')}
                </NavLink>
              )}
              {isAdmin && (
                <>
                  <div className="my-2 border-t border-border" />
                  <NavLink to={ROUTES.adminActors} className={navLinkClass}>
                    <ion-icon name="person-circle" />
                    {t('adminLayout.nav.actors')}
                  </NavLink>
                  <NavLink to={ROUTES.adminDirectors} className={navLinkClass}>
                    <ion-icon name="videocam" />
                    {t('adminLayout.nav.directors')}
                  </NavLink>
                  <NavLink to={ROUTES.adminTransactions} className={navLinkClass}>
                    <ion-icon name="card" />
                    {t('adminLayout.nav.transactions')}
                  </NavLink>
                  <NavLink to={ROUTES.adminPayments} className={navLinkClass}>
                    <ion-icon name="wallet" />
                    {t('adminLayout.nav.payments')}
                  </NavLink>
                  <NavLink to={ROUTES.adminReviews} className={navLinkClass}>
                    <ion-icon name="star" />
                    {t('adminLayout.nav.reviews')}
                  </NavLink>
                </>
              )}
            </>
          )}
        </nav>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-end gap-3 border-b border-border px-6 py-3">
          <LanguageSwitcher />
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-txt transition-colors hover:bg-white/5"
              onClick={() => setIsUserMenuOpen((open) => !open)}
              aria-label={t('adminLayout.toggleMenu')}
            >
              <Avatar src={user?.avatar} name={displayName} size="sm" />
              {displayName}
              <i
                className={cn(
                  'fa-solid fa-chevron-down text-[10px] text-txt/60 transition-transform',
                  isUserMenuOpen && 'rotate-180',
                )}
              />
            </button>
            {isUserMenuOpen && (
              <ul className="absolute right-0 top-full z-10 mt-2 w-44 rounded-lg border border-border-strong bg-surface-raised p-1.5 shadow-raised">
                <li className="px-3 py-2 text-sm font-medium text-txt/60">{displayName}</li>
                <li className="border-t border-border pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <i className="fa-solid fa-right-from-bracket mr-2 w-4" />
                    {t('header.logout')}
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
        <div className="flex h-12 items-center gap-2 border-b border-border bg-surface/60 px-6 text-sm">
          <span className="text-txt/50">{t('adminLayout.breadcrumbPrefix')}</span>
          <i className="fa-solid fa-chevron-right text-[10px] text-accent" />
          <span className="font-medium text-accent">{breadcrumb}</span>
          <div className="ml-auto flex items-center gap-1.5 text-txt/60">
            <span>{t('adminLayout.hello')}</span>
            <span className="font-medium text-txt">{displayName}</span>
          </div>
        </div>
        <div className="p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}
