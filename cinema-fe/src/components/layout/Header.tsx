import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { MovieMegaMenu } from '@/components/layout/MovieMegaMenu';
import { CinemaMenu } from '@/components/layout/CinemaMenu';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { logout } from '@/features/auth/store/authSlice';
import { logout as logoutApi } from '@/features/auth/api/auth.api';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { toast } from '@/features/notifications/toast';
import { MANAGEMENT_ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';

const navLinkClass =
  'relative py-2 text-sm font-semibold uppercase tracking-wide text-txt/80 no-underline transition-colors hover:text-txt after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-accent after:transition-transform hover:after:scale-x-100';

const dropdownLinkClass =
  'block rounded-md px-3 py-2 text-sm text-txt/80 no-underline transition-colors hover:bg-white/5 hover:text-txt';

export function Header() {
  const { t } = useTranslation('common');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<'movies' | 'cinemas' | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { accessToken, role } = useAppSelector((state) => state.auth);
  const isLoggedIn = !!accessToken;
  const canManage = MANAGEMENT_ROLES.includes(Number(role));
  const { data: user } = useCurrentUser();
  const name = user?.name ?? '';

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The mobile menu covers the viewport, so the page behind it must not scroll away.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileMenuOpen]);

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logoutApi().catch(() => {});
    dispatch(logout());
    queryClient.clear();
    toast.success(t('header.logoutSuccess'));
    navigate(ROUTES.home);
  };

  return (
    <nav
      className={cn(
        'fixed inset-x-0 top-0 z-30 h-20 border-b border-border bg-main/95 font-sans text-txt backdrop-blur-md transition-shadow duration-300',
        isScrolled && 'shadow-card',
      )}
    >
      <div className="relative mx-auto flex h-full w-full max-w-7xl items-center gap-4 px-6 md:px-10">
        <Link to={ROUTES.home} className="flex items-center gap-2 whitespace-nowrap no-underline">
          <i className="fa-solid fa-film text-xl text-accent" aria-hidden="true" />
          <b className="font-script text-3xl leading-none text-txt">
            {t('brand')}
            <span className="text-accent">.</span>
          </b>
        </Link>

        <Link
          to={ROUTES.playing}
          className="hidden items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white no-underline shadow-card transition-all hover:bg-accent-hover hover:shadow-glow lg:inline-flex"
        >
          <i className="fa-solid fa-ticket" aria-hidden="true" />
          {t('header.bookNow')}
        </Link>

        <button
          type="button"
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-white transition-colors hover:bg-white/10 md:hidden"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          aria-label={t('header.toggleMenu')}
        >
          <i className={cn('fas', isMobileMenuOpen ? 'fa-xmark' : 'fa-bars')} />
        </button>

        <ul
          className={cn(
            'flex-col items-stretch gap-1 border-t border-border bg-main md:static md:ml-auto md:flex md:w-auto md:flex-row md:items-center md:gap-1 md:border-none md:bg-transparent',
            'fixed inset-x-0 top-20 z-20 h-[calc(100vh-5rem)] overflow-y-auto pb-6 md:inset-auto md:h-full md:overflow-visible md:pb-0',
            isMobileMenuOpen ? 'flex' : 'hidden md:flex',
          )}
        >
          <li className="px-4 py-3 text-center md:px-3 md:py-0">
            <Link to={ROUTES.home} className={navLinkClass}>
              {t('nav.home')}
            </Link>
          </li>
          {/* No `relative` here: the mega menu below anchors to the header container so it can
              span the full width, while staying a descendant of this item for hover purposes. */}
          <li
            className="px-4 py-3 text-center md:flex md:h-full md:items-center md:px-3 md:py-0"
            onMouseEnter={() => setOpenMenu('movies')}
            onMouseLeave={() => setOpenMenu(null)}
          >
            <span className={cn(navLinkClass, 'cursor-default select-none')}>
              {t('nav.movies')}{' '}
              <i
                className={cn(
                  'fa-solid fa-chevron-down ml-1 text-[10px] transition-transform',
                  openMenu === 'movies' && 'rotate-180',
                )}
              />
            </span>
            {/* Mobile keeps the plain links; desktop gets the poster mega menu below the bar. */}
            <ul className="mt-2 flex flex-col gap-1 md:hidden">
              <li>
                <Link to={ROUTES.playing} className={dropdownLinkClass}>
                  {t('nav.playing')}
                </Link>
              </li>
              <li>
                <Link to={ROUTES.upcoming} className={dropdownLinkClass}>
                  {t('nav.upcoming')}
                </Link>
              </li>
            </ul>
            {openMenu === 'movies' && (
              <div className="absolute left-6 top-full z-30 hidden md:left-10 md:block">
                <MovieMegaMenu open onNavigate={() => setOpenMenu(null)} />
              </div>
            )}
          </li>
          <li
            className="relative px-4 py-3 text-center md:px-3 md:py-0"
            onMouseEnter={() => setOpenMenu('cinemas')}
            onMouseLeave={() => setOpenMenu(null)}
          >
            <Link to={ROUTES.cinemas} className={navLinkClass}>
              {t('nav.cinemas')}{' '}
              <i
                className={cn(
                  'fa-solid fa-chevron-down ml-1 text-[10px] transition-transform',
                  openMenu === 'cinemas' && 'rotate-180',
                )}
              />
            </Link>
            {openMenu === 'cinemas' && (
              // pt keeps the panel flush with the bottom of the bar and bridges the hover gap
              <div className="absolute left-1/2 top-full z-30 hidden -translate-x-1/2 pt-7 md:block">
                <CinemaMenu open onNavigate={() => setOpenMenu(null)} />
              </div>
            )}
          </li>
          <li className="px-4 py-3 text-center md:hidden">
            <Link
              to={ROUTES.playing}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white no-underline shadow-card transition-all hover:bg-accent-hover"
            >
              <i className="fa-solid fa-ticket" aria-hidden="true" />
              {t('header.bookNow')}
            </Link>
          </li>
          <li className="flex items-center justify-center px-4 py-3 md:px-1 md:py-0">
            <LanguageSwitcher />
          </li>
          {isLoggedIn ? (
            <li className="relative px-4 py-3 text-center md:px-1 md:py-0">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/10 md:w-auto"
                onClick={() => setIsUserMenuOpen((open) => !open)}
                aria-label={t('header.toggleUserMenu')}
              >
                <Avatar src={user?.avatar} name={name} size="sm" />
                <span className="text-sm font-medium text-txt">{name}</span>
                <i
                  className={cn(
                    'fa-solid fa-chevron-down text-[10px] text-txt/60 transition-transform',
                    isUserMenuOpen && 'rotate-180',
                  )}
                />
              </button>
              {isUserMenuOpen && (
                <ul className="static mt-2 flex flex-col gap-1 md:absolute md:right-0 md:top-full md:mt-2 md:w-48 md:rounded-lg md:border md:border-border-strong md:bg-surface-raised md:p-1.5 md:shadow-raised">
                  <li>
                    <Link
                      to={ROUTES.profile}
                      className={cn(dropdownLinkClass, 'text-left')}
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <i className="fa-regular fa-user mr-2 w-4" />
                      {t('header.viewProfile')}
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={ROUTES.myBookings}
                      className={cn(dropdownLinkClass, 'text-left')}
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <i className="fa-solid fa-ticket mr-2 w-4" />
                      {t('header.myBookings')}
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={ROUTES.changePassword}
                      className={cn(dropdownLinkClass, 'text-left')}
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <i className="fa-solid fa-lock mr-2 w-4" />
                      {t('header.changePassword')}
                    </Link>
                  </li>
                  {canManage && (
                    <li>
                      <Link
                        to={ROUTES.adminMovies}
                        className={cn(dropdownLinkClass, 'text-left')}
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <i className="fa-solid fa-gauge mr-2 w-4" />
                        {t('header.manage')}
                      </Link>
                    </li>
                  )}
                  <li className="mt-1 border-t border-border pt-1">
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
            </li>
          ) : (
            <li className="px-4 py-3 text-center md:pl-2 md:pr-0">
              <Link
                to={ROUTES.login}
                className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-txt no-underline transition-all hover:border-accent hover:text-accent"
              >
                <i className="fas fa-user text-xs" />
                {t('header.login')}
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
