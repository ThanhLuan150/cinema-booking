// Single source of truth for every server -> client socket.io event name.
//
// Keeping the names here (instead of as string literals scattered across controllers) is what
// makes it possible to tell, at a glance, which domains push realtime updates and which don't —
// and it keeps the frontend mirror (cinema-fe/src/lib/realtimeEvents.ts) honest.
//
// Naming rule: `<domain>:<action>`. Domains that have more than a couple of transitions publish
// one `<domain>:updated` event carrying an `action` discriminator in the payload, so the client
// registers one listener per domain instead of one per transition.

const REALTIME_EVENT = {
  // --- platform -------------------------------------------------------------------------
  UNAUTHORIZED: 'unauthorized',
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_TEMPLATE_UPDATED: 'notificationTemplate:updated',
  SYSTEM_CONFIG_UPDATED: 'systemConfig:updated',
  PRICING_UPDATED: 'pricing:updated',
  AUDIT_LOG_NEW: 'auditLog:new',
  // Emitted by company.controller, but the frontend has no company console yet, so nothing
  // listens for it. Kept because the write endpoints are real — the listener is the missing half.
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
  MEMBERSHIP_UPDATED: 'membership:updated',
  EMPLOYEE_UPDATED: 'employee:updated',

  // --- branch operations ------------------------------------------------------------------
  CHECKIN_NEW: 'checkin:new',
  MAINTENANCE_UPDATED: 'maintenance:updated',
  ROOM_UPDATED: 'room:updated',
  SUPPORT_UPDATED: 'support:updated',
  PARKING_UPDATED: 'parking:updated',
  INVENTORY_UPDATED: 'inventory:updated',
  SHIFT_UPDATED: 'shift:updated',
  // Same change as shift:updated, addressed to the one employee it is about (account room) so they
  // get a toast. A different name on purpose: the employee is also in the branch room that
  // carries shift:updated, and one event name must only ever travel down one channel.
  MY_SHIFT_UPDATED: 'myShift:updated',
  ATTENDANCE_UPDATED: 'attendance:updated',
  CASHIER_SHIFT_UPDATED: 'cashierShift:updated',
  PRIVATE_EVENT_UPDATED: 'privateEvent:updated',
  SIGNAGE_UPDATED: 'signage:updated',
  DEVICE_UPDATED: 'device:updated',
  KIOSK_UPDATED: 'kiosk:updated',
  ENTRANCE_UPDATED: 'entrance:updated',
};

// Client -> server. The seat map is the only place a client asks to be subscribed to something
// narrower than its account/branch rooms, because a schedule room is per-showtime and short-lived.
const CLIENT_EVENT = {
  SCHEDULE_JOIN: 'schedule:join',
  SCHEDULE_LEAVE: 'schedule:leave',
};

// Payload discriminators for the `<domain>:updated` events.
const REALTIME_ACTION = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  STATUS_CHANGED: 'STATUS_CHANGED',
};

module.exports = { REALTIME_EVENT, CLIENT_EVENT, REALTIME_ACTION };
