export const ABOUT_STATS = ['cinemas', 'seats', 'movies', 'customers'] as const;

export const ABOUT_VALUES = [
  { key: 'quality', icon: 'fa-solid fa-clapperboard' },
  { key: 'comfort', icon: 'fa-solid fa-couch' },
  { key: 'easyBooking', icon: 'fa-solid fa-ticket' },
  { key: 'support', icon: 'fa-solid fa-headset' },
] as const;

/** `href` builds the tel:/mailto: link from the translated value; plain cards omit it. */
export const CONTACT_CHANNELS = [
  {
    key: 'hotline',
    icon: 'fa-solid fa-phone',
    href: (value: string) => `tel:${value.replace(/\s/g, '')}`,
  },
  { key: 'email', icon: 'fa-solid fa-envelope', href: (value: string) => `mailto:${value}` },
  { key: 'office', icon: 'fa-solid fa-location-dot' },
  { key: 'hours', icon: 'fa-solid fa-clock' },
] as const;

export const FAQ_QUESTIONS = [
  'booking',
  'payment',
  'cancel',
  'checkTicket',
  'voucher',
  'combo',
  'account',
  'contact',
] as const;
