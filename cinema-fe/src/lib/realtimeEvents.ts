// Mirror of cinema-be/src/utils/realtimeEvents.js. The two files must stay in step — a typo here
// is a listener that silently never fires, which is exactly the kind of bug a string literal
// scattered across components hides.

export const REALTIME_EVENT = {
  // --- platform -------------------------------------------------------------------------
  UNAUTHORIZED: 'unauthorized',
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_TEMPLATE_UPDATED: 'notificationTemplate:updated',
  SYSTEM_CONFIG_UPDATED: 'systemConfig:updated',
  PRICING_UPDATED: 'pricing:updated',
  AUDIT_LOG_NEW: 'auditLog:new',
  COMPANY_UPDATED: 'company:updated',
  USER_UPDATED: 'user:updated',
  LOYALTY_UPDATED: 'loyalty:updated',
  NOTIFICATION_READ: 'notification:read',
  INTEGRATION_UPDATED: 'integration:updated',
  WEBHOOK_UPDATED: 'webhook:updated',

  // --- catalogue (public) ---------------------------------------------------------------
  MOVIE_NEW: 'movie:new',
  MOVIE_UPDATED: 'movie:updated',
  MOVIE_REMOVED: 'movie:removed',
  CAMPAIGN_UPDATED: 'campaign:updated',
  PROMOTION_UPDATED: 'promotion:updated',
  VOUCHER_UPDATED: 'voucher:updated',
  REVIEW_UPDATED: 'review:updated',
  DISTRIBUTION_UPDATED: 'distribution:updated',
  CATALOGUE_UPDATED: 'catalogue:updated',
  LIKE_UPDATED: 'like:updated',
  MEMBERSHIP_UPDATED: 'membership:updated',

  // --- branch lifecycle -----------------------------------------------------------------
  BRANCH_ACTIVATED: 'branch:activated',
  BRANCH_DISABLED: 'branch:disabled',
  BRANCH_MAINTENANCE: 'branch:maintenance',
  BRANCH_UPDATED: 'branch:updated',

  // --- showtimes ------------------------------------------------------------------------
  SCHEDULE_UPDATED: 'schedule:updated',
  SHOWTIME_CANCELLED: 'showtime:cancelled',
  SHOWTIME_RESCHEDULED: 'showtime:rescheduled',

  // --- live seat map (schedule room) ------------------------------------------------------
  SEAT_UPDATED: 'seat:updated',

  // --- sales ----------------------------------------------------------------------------
  BOOKING_NEW: 'booking:new',
  BOOKING_UPDATED: 'booking:updated',
  PAYMENT_UPDATED: 'payment:updated',
  REFUND_UPDATED: 'refund:updated',
  GIFT_CARD_UPDATED: 'giftCard:updated',
  COMBO_ORDER_UPDATED: 'comboOrder:updated',
  COMBO_UPDATED: 'combo:updated',

  // --- branch operations ------------------------------------------------------------------
  CHECKIN_NEW: 'checkin:new',
  MAINTENANCE_UPDATED: 'maintenance:updated',
  ROOM_UPDATED: 'room:updated',
  SUPPORT_UPDATED: 'support:updated',
  PARKING_UPDATED: 'parking:updated',
  INVENTORY_UPDATED: 'inventory:updated',
  SHIFT_UPDATED: 'shift:updated',
  MY_SHIFT_UPDATED: 'myShift:updated',
  ATTENDANCE_UPDATED: 'attendance:updated',
  CASHIER_SHIFT_UPDATED: 'cashierShift:updated',
  PRIVATE_EVENT_UPDATED: 'privateEvent:updated',
  SIGNAGE_UPDATED: 'signage:updated',
  DEVICE_UPDATED: 'device:updated',
  KIOSK_UPDATED: 'kiosk:updated',
  ENTRANCE_UPDATED: 'entrance:updated',
  EMPLOYEE_UPDATED: 'employee:updated',
} as const;

// Client -> server.
export const CLIENT_EVENT = {
  SCHEDULE_JOIN: 'schedule:join',
  SCHEDULE_LEAVE: 'schedule:leave',
} as const;

export const REALTIME_ACTION = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  STATUS_CHANGED: 'STATUS_CHANGED',
} as const;

export type RealtimeAction = (typeof REALTIME_ACTION)[keyof typeof REALTIME_ACTION];
