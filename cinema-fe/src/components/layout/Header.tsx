import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SearchBox } from '@/components/common/SearchBox';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
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
  'relative py-2 text-sm font-medium text-txt/80 no-underline transition-colors hover:text-txt after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-accent after:transition-transform hover:after:scale-x-100';

export function Header() {
  const { t } = useTranslation('common');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
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
        'fixed inset-x-0 top-0 z-30 flex h-20 items-center justify-between px-6 font-sans text-txt transition-all duration-300 md:px-[6%]',
        isScrolled
          ? 'border-b border-border bg-main/85 shadow-card backdrop-blur-md'
          : 'border-b border-transparent bg-gradient-to-b from-black/70 to-transparent',
      )}
    >
      <Link to={ROUTES.home} className="flex items-center gap-2 whitespace-nowrap no-underline">
        <i className="fa-solid fa-film text-xl text-accent" aria-hidden="true" />
        <b className="font-script text-3xl leading-none text-txt">
          {t('brand')}
          <span className="text-accent">.</span>
        </b>
      </Link>

      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-white transition-colors hover:bg-white/10 md:hidden"
        onClick={() => setIsMobileMenuOpen((open) => !open)}
        aria-label={t('header.toggleMenu')}
      >
        <i className={cn('fas', isMobileMenuOpen ? 'fa-xmark' : 'fa-bars')} />
      </button>

      <ul
        className={cn(
          'flex-col items-stretch gap-1 border-t border-border bg-main/95 backdrop-blur-md md:static md:flex md:w-auto md:flex-row md:items-center md:gap-1 md:border-none md:bg-transparent md:backdrop-blur-none',
          'fixed inset-x-0 top-20 z-20 max-h-[calc(100vh-5rem)] overflow-y-auto md:inset-auto md:max-h-none md:overflow-visible',
          isMobileMenuOpen ? 'flex' : 'hidden md:flex',
        )}
      >
        <li className="px-4 py-3 text-center md:px-4 md:py-0">
          <Link to={ROUTES.home} className={navLinkClass}>
            {t('nav.home')}
          </Link>
        </li>
        <li className="group relative px-4 py-3 text-center md:px-4 md:py-0">
          <span className={cn(navLinkClass, 'cursor-default select-none')}>
            {t('nav.movies')} <i className="fa-solid fa-chevron-down ml-1 text-[10px]" />
          </span>
          <ul className="static mt-2 flex flex-col gap-1 bg-transparent md:absolute md:left-0 md:top-full md:mt-1 md:hidden md:w-44 md:rounded-lg md:border md:border-border-strong md:bg-surface-raised md:p-1.5 md:shadow-raised md:group-hover:block">
            <li>
              <Link
                to={ROUTES.playing}
                className="block rounded-md px-3 py-2 text-sm text-txt/80 no-underline transition-colors hover:bg-white/5 hover:text-txt"
              >
                {t('nav.playing')}
              </Link>
            </li>
            <li>
              <Link
                to={ROUTES.upcoming}
                className="block rounded-md px-3 py-2 text-sm text-txt/80 no-underline transition-colors hover:bg-white/5 hover:text-txt"
              >
                {t('nav.upcoming')}
              </Link>
            </li>
          </ul>
        </li>
        <li className="px-4 py-3 text-center md:px-4 md:py-0">
          <Link to={ROUTES.cinemas} className={navLinkClass}>
            {t('nav.cinemas')}
          </Link>
        </li>
        <li className="relative px-4 py-3 text-center md:px-2 md:py-0">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-txt/80 transition-colors hover:bg-white/10 hover:text-txt"
            onClick={() => setIsSearchOpen((open) => !open)}
            aria-label={t('header.toggleSearch')}
          >
            <i className="fas fa-search" />
          </button>
          {isSearchOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-80 animate-slide-up">
              <SearchBox />
            </div>
          )}
        </li>
        <li className="flex items-center justify-center px-4 py-3 md:px-2 md:py-0">
          <LanguageSwitcher />
        </li>
        {isLoggedIn ? (
          <li className="relative px-4 py-3 text-center md:px-2 md:py-0">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/10 md:w-auto"
              onClick={() => setIsUserMenuOpen((open) => !open)}
              aria-label={t('header.toggleUserMenu')}
            >
              <Avatar src={user?.avatar} name={name} size="sm" />
              <span className="text-sm font-medium text-txt">{name}</span>
              <i className={cn('fa-solid fa-chevron-down text-[10px] text-txt/60 transition-transform', isUserMenuOpen && 'rotate-180')} />
            </button>
            {isUserMenuOpen && (
              <ul className="static mt-2 flex flex-col gap-1 md:absolute md:right-0 md:top-full md:mt-2 md:w-48 md:rounded-lg md:border md:border-border-strong md:bg-surface-raised md:p-1.5 md:shadow-raised">
                <li>
                  <Link
                    to={ROUTES.profile}
                    className="block rounded-md px-3 py-2 text-left text-sm text-txt/80 no-underline transition-colors hover:bg-white/5 hover:text-txt"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <i className="fa-regular fa-user mr-2 w-4" />
                    {t('header.viewProfile')}
                  </Link>
                </li>
                <li>
                  <Link
                    to={ROUTES.myBookings}
                    className="block rounded-md px-3 py-2 text-left text-sm text-txt/80 no-underline transition-colors hover:bg-white/5 hover:text-txt"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <i className="fa-solid fa-ticket mr-2 w-4" />
                    {t('header.myBookings')}
                  </Link>
                </li>
                <li>
                  <Link
                    to={ROUTES.changePassword}
                    className="block rounded-md px-3 py-2 text-left text-sm text-txt/80 no-underline transition-colors hover:bg-white/5 hover:text-txt"
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
                      className="block rounded-md px-3 py-2 text-left text-sm text-txt/80 no-underline transition-colors hover:bg-white/5 hover:text-txt"
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
          <li className="px-4 py-3 text-center md:pl-3 md:pr-0">
            <Link
              to={ROUTES.login}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white no-underline shadow-card transition-all hover:bg-accent-hover hover:shadow-glow"
            >
              {t('header.login')} <i className="fas fa-user text-xs" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
