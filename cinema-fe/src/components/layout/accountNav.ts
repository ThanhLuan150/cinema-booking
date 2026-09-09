import type { TFunction } from 'i18next';
import { ROUTES } from '@/constants/routes';

export interface AccountNavItem {
  to: string;
  icon: string;
  label: string;
}

// Single source of truth for the logged-in customer's account area — used by both the header
// user dropdown and the AccountLayout side rail so the two never drift apart.
export function buildAccountNavItems(t: TFunction): AccountNavItem[] {
  return [
    { to: ROUTES.profile, icon: 'fa-regular fa-user', label: t('header.viewProfile') },
    { to: ROUTES.myMembership, icon: 'fa-solid fa-crown', label: t('header.myMembership') },
    { to: ROUTES.myGiftCards, icon: 'fa-solid fa-gift', label: t('header.myGiftCards') },
    { to: ROUTES.myBookings, icon: 'fa-solid fa-ticket', label: t('header.myBookings') },
    { to: ROUTES.myTickets, icon: 'fa-solid fa-qrcode', label: t('header.myTickets') },
    { to: ROUTES.paymentHistory, icon: 'fa-solid fa-receipt', label: t('header.paymentHistory') },
    { to: ROUTES.myRefunds, icon: 'fa-solid fa-hand-holding-dollar', label: t('header.myRefunds') },
    { to: ROUTES.notifications, icon: 'fa-regular fa-bell', label: t('header.notifications') },
    { to: ROUTES.changePassword, icon: 'fa-solid fa-lock', label: t('header.changePassword') },
  ];
}
