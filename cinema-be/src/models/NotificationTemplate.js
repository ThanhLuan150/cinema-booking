const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// Ticket 26 — the editable content behind every notification the system raises. A template is
// keyed by (event, channel, language); notification.service looks one up when it needs to build
// a message and renders its `subject` / `content` against the safe display context (see
// utils/templateRenderer). When no ACTIVE template matches, the service falls back to its
// built-in hardcoded copy, so an empty template table changes nothing.

// The seven business events a template can be written for (per the ticket). These are the
// template-facing names; notification.service maps its own internal EVENT vocabulary onto them
// (e.g. BOOKING_CREATED -> BOOKING_SUCCESS, REFUND_COMPLETED -> REFUND_SUCCESS).
const EVENT = {
  BOOKING_SUCCESS: 'BOOKING_SUCCESS',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  TICKET_ISSUED: 'TICKET_ISSUED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  REFUND_SUCCESS: 'REFUND_SUCCESS',
  SHOWTIME_CANCELLED: 'SHOWTIME_CANCELLED',
  SHOWTIME_CHANGED: 'SHOWTIME_CHANGED',
};

// Architecture is prepared for all three delivery channels. SUPPORTED_CHANNELS is the subset
// this deployment can actually deliver today — the API refuses to create/activate a template
// for anything outside it, so SMS templates can't be authored until an SMS provider is wired.
const CHANNEL = { EMAIL: 'EMAIL', IN_APP: 'IN_APP', SMS: 'SMS' };
const SUPPORTED_CHANNELS = [CHANNEL.EMAIL, CHANNEL.IN_APP];

const STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };

// Kept in step with the frontend's i18n languages; `vi` is the platform default (fallbackLng).
const LANGUAGE = { VI: 'vi', EN: 'en' };
const SUPPORTED_LANGUAGES = Object.values(LANGUAGE);
const DEFAULT_LANGUAGE = LANGUAGE.VI;

// Which {{variables}} each event is able to fill. notification.service can only ever supply
// values drawn from the safe booking context, so a template that references anything outside
// its event's list is rejected at write time.
const BASE_VARIABLES = ['customer_name', 'movie_name', 'branch_name', 'room_name', 'showtime'];
const VARIABLES_BY_EVENT = {
  BOOKING_SUCCESS: [...BASE_VARIABLES, 'seat', 'booking_code'],
  PAYMENT_SUCCESS: [...BASE_VARIABLES, 'seat', 'booking_code'],
  TICKET_ISSUED: [...BASE_VARIABLES, 'seat', 'booking_code', 'ticket_code'],
  BOOKING_CANCELLED: [...BASE_VARIABLES, 'booking_code'],
  REFUND_SUCCESS: [...BASE_VARIABLES, 'booking_code'],
  SHOWTIME_CANCELLED: [...BASE_VARIABLES, 'booking_code'],
  SHOWTIME_CHANGED: [...BASE_VARIABLES, 'booking_code'],
};

const notificationTemplateSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    event: { type: String, enum: Object.values(EVENT), required: true, index: true },
    channel: { type: String, enum: Object.values(CHANNEL), required: true, index: true },
    // Subject / title line. Required for EMAIL; IN_APP ignores it and keeps the generated title.
    subject: { type: String, default: '' },
    content: { type: String, required: true },
    language: { type: String, enum: SUPPORTED_LANGUAGES, default: DEFAULT_LANGUAGE, index: true },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.ACTIVE, index: true },
    // Free-text note for admins ("used for the post-payment email", etc.). Never rendered.
    description: { type: String, default: '' },
    updated_by: { type: Number, default: null },
  },
  { timestamps: true },
);

// "No duplicate template" — exactly one row per event + channel + language.
notificationTemplateSchema.index({ event: 1, channel: 1, language: 1 }, { unique: true });

withCleanJSON(notificationTemplateSchema);

const NotificationTemplate = mongoose.model('NotificationTemplate', notificationTemplateSchema);

NotificationTemplate.EVENT = EVENT;
NotificationTemplate.CHANNEL = CHANNEL;
NotificationTemplate.STATUS = STATUS;
NotificationTemplate.LANGUAGE = LANGUAGE;
NotificationTemplate.SUPPORTED_CHANNELS = SUPPORTED_CHANNELS;
NotificationTemplate.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
NotificationTemplate.DEFAULT_LANGUAGE = DEFAULT_LANGUAGE;
NotificationTemplate.VARIABLES_BY_EVENT = VARIABLES_BY_EVENT;
NotificationTemplate.allowedVariables = (event) => VARIABLES_BY_EVENT[event] || [];

module.exports = NotificationTemplate;
