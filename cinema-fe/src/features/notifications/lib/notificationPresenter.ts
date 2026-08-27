import type { TFunction } from 'i18next';
import type { Notification, NotificationType } from '@/types/entities';

// Maps a notification's machine `type` + safe `data` to localised, display-ready text and an
// icon. The backend also ships a plain-language `body` as a fallback (used for e-mail); here we
// prefer the localised string so the feed follows the user's language.

const ICONS: Record<NotificationType, string> = {
  BOOKING_CREATED: 'fa-regular fa-calendar-check',
  PAYMENT_SUCCESS: 'fa-solid fa-circle-check',
  PAYMENT_FAILED: 'fa-solid fa-circle-xmark',
  TICKET_ISSUED: 'fa-solid fa-ticket',
  BOOKING_CANCELLED: 'fa-solid fa-ban',
  REFUND_COMPLETED: 'fa-solid fa-rotate-left',
  SHOWTIME_CANCELLED: 'fa-solid fa-calendar-xmark',
  SHOWTIME_CHANGED: 'fa-solid fa-calendar-day',
};

const TONE: Record<NotificationType, 'positive' | 'negative' | 'neutral'> = {
  BOOKING_CREATED: 'neutral',
  PAYMENT_SUCCESS: 'positive',
  PAYMENT_FAILED: 'negative',
  TICKET_ISSUED: 'positive',
  BOOKING_CANCELLED: 'negative',
  REFUND_COMPLETED: 'positive',
  SHOWTIME_CANCELLED: 'negative',
  SHOWTIME_CHANGED: 'neutral',
};

export interface PresentedNotification {
  icon: string;
  tone: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
}

export function presentNotification(n: Notification, t: TFunction): PresentedNotification {
  const d = n.data ?? {};
  const showtime = d.showtime ? `${d.showtime.date} ${d.showtime.time_begin}` : '';
  const vars = {
    movie: d.movie ?? '',
    branch: d.branch ?? '',
    room: d.room ?? '',
    showtime,
    seats: Array.isArray(d.seats) ? d.seats.join(', ') : '',
    bookingCode: d.bookingCode ?? '',
    amount: typeof d.amount === 'number' ? d.amount.toLocaleString() : '',
  };

  return {
    icon: ICONS[n.type] ?? 'fa-regular fa-bell',
    tone: TONE[n.type] ?? 'neutral',
    title: t(`notifications.feed.types.${n.type}.title`, { defaultValue: n.title }),
    description: t(`notifications.feed.types.${n.type}.body`, { defaultValue: n.body, ...vars }),
  };
}
