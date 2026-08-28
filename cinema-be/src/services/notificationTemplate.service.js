const NotificationTemplate = require('../models/NotificationTemplate');
const Account = require('../models/Account');
const templateRepository = require('../repositories/notificationTemplate.repository');
const { render, extractVariables } = require('../utils/templateRenderer');

// Ticket 26 — the rules layer for notification templates:
//   - validate()        : everything the API must reject before a template is stored.
//   - renderPreview()   : safe render against sample data, for the editor's live preview.
//   - resolveContent()  : what notification.service calls to turn an event into a rendered
//                         { subject, body } — or null, meaning "fall back to the built-in copy".

const {
  EVENT,
  CHANNEL,
  STATUS,
  SUPPORTED_CHANNELS,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
} = NotificationTemplate;

// notification.service speaks its own internal event names; map them onto the template events.
// Anything not listed here (e.g. PAYMENT_FAILED) simply has no template and uses hardcoded copy.
const TEMPLATE_EVENT_BY_NOTIFICATION_EVENT = {
  BOOKING_CREATED: EVENT.BOOKING_SUCCESS,
  PAYMENT_SUCCESS: EVENT.PAYMENT_SUCCESS,
  TICKET_ISSUED: EVENT.TICKET_ISSUED,
  BOOKING_CANCELLED: EVENT.BOOKING_CANCELLED,
  REFUND_COMPLETED: EVENT.REFUND_SUCCESS,
  SHOWTIME_CANCELLED: EVENT.SHOWTIME_CANCELLED,
  SHOWTIME_CHANGED: EVENT.SHOWTIME_CHANGED,
};

// Realistic-looking values so an admin can see what a rendered message will read like.
const SAMPLE_VARIABLES = {
  customer_name: 'Nguyen Van A',
  movie_name: 'Dune: Part Two',
  branch_name: 'CGV Vincom Center',
  room_name: 'Room 3',
  showtime: '2026-09-01 19:30',
  seat: 'A1, A2',
  booking_code: 'BK-2X9F4',
  ticket_code: 'TK-77A1B2',
};

class TemplateValidationError extends Error {
  constructor(details) {
    super('Template validation failed');
    this.name = 'TemplateValidationError';
    this.status = 400;
    this.details = details;
  }
}

// Validates a *complete* logical template. For an update, the controller merges the patch onto
// the existing row first and passes the whole thing here. Returns the normalised fields on
// success; throws TemplateValidationError (with a per-field `details` array) otherwise.
function validate(input = {}) {
  const event = input.event;
  const channel = input.channel;
  const language = input.language || DEFAULT_LANGUAGE;
  const status = input.status || STATUS.ACTIVE;
  const subject = input.subject == null ? '' : String(input.subject);
  const content = input.content == null ? '' : String(input.content);

  const errors = [];

  if (!event || !Object.values(EVENT).includes(event)) {
    errors.push({ field: 'event', message: `event must be one of: ${Object.values(EVENT).join(', ')}` });
  }
  if (!channel || !Object.values(CHANNEL).includes(channel)) {
    errors.push({ field: 'channel', message: `channel must be one of: ${Object.values(CHANNEL).join(', ')}` });
  } else if (!SUPPORTED_CHANNELS.includes(channel)) {
    errors.push({
      field: 'channel',
      code: 'CHANNEL_NOT_SUPPORTED',
      message: `channel ${channel} is not deliverable by this deployment yet (supported: ${SUPPORTED_CHANNELS.join(', ')})`,
    });
  }
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    errors.push({ field: 'language', message: `language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` });
  }
  if (!Object.values(STATUS).includes(status)) {
    errors.push({ field: 'status', message: `status must be one of: ${Object.values(STATUS).join(', ')}` });
  }
  if (!content.trim()) {
    errors.push({ field: 'content', message: 'content is required' });
  }
  if (channel === CHANNEL.EMAIL && !subject.trim()) {
    errors.push({ field: 'subject', message: 'subject is required for EMAIL templates' });
  }

  // Unknown-variable check — only meaningful once we know the event is valid.
  if (event && Object.values(EVENT).includes(event)) {
    const allowed = NotificationTemplate.allowedVariables(event);
    const used = [...new Set([...extractVariables(subject), ...extractVariables(content)])];
    const unknown = used.filter((name) => !allowed.includes(name));
    if (unknown.length) {
      errors.push({
        field: 'content',
        code: 'UNKNOWN_VARIABLES',
        message: `unknown variable(s) for ${event}: ${unknown.map((u) => `{{${u}}}`).join(', ')}`,
        unknown,
        allowed,
      });
    }
  }

  if (errors.length) throw new TemplateValidationError(errors);

  return { event, channel, language, status, subject, content };
}

// Keeps only safe, primitive overrides an admin may type into the preview form.
function sanitizeOverrides(overrides) {
  const out = {};
  if (!overrides || typeof overrides !== 'object') return out;
  for (const [key, value] of Object.entries(overrides)) {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
    if (value == null) continue;
    if (['string', 'number', 'boolean'].includes(typeof value)) out[key] = value;
  }
  return out;
}

function renderPreview({ subject = '', content = '', variables } = {}) {
  const vars = { ...SAMPLE_VARIABLES, ...sanitizeOverrides(variables) };
  return {
    subject: render(String(subject || ''), vars),
    content: render(String(content || ''), vars),
    variablesUsed: [...new Set([...extractVariables(String(subject || '')), ...extractVariables(String(content || ''))])],
  };
}

// Flattens the notifier's safe context object into the flat {{variable}} map templates use.
function buildVariables(ctx = {}) {
  const showtime = ctx.showtime
    ? [ctx.showtime.date, ctx.showtime.time_begin].filter(Boolean).join(' ')
    : ctx.showtime_text || '';
  return {
    customer_name: ctx.customer_name || ctx.customerName || '',
    movie_name: ctx.movie || ctx.movie_name || '',
    branch_name: ctx.branch || ctx.branch_name || '',
    room_name: ctx.room || ctx.room_name || '',
    showtime,
    seat: Array.isArray(ctx.seats) ? ctx.seats.join(', ') : ctx.seat || '',
    booking_code: ctx.bookingCode || ctx.booking_code || '',
    ticket_code: Array.isArray(ctx.ticketCodes) ? ctx.ticketCodes.join(', ') : ctx.ticket_code || '',
  };
}

// Called by notification.service. Returns { subject, body, templateId } when an ACTIVE template
// matches, else null (→ caller keeps its built-in copy). Never throws.
async function resolveContent({ event, channel, language = DEFAULT_LANGUAGE, ctx = {}, accountId } = {}) {
  try {
    const templateEvent = TEMPLATE_EVENT_BY_NOTIFICATION_EVENT[event] || event;
    if (!Object.values(EVENT).includes(templateEvent)) return null;
    if (!SUPPORTED_CHANNELS.includes(channel)) return null;

    let template = await templateRepository.findActive({ event: templateEvent, channel, language });
    if (!template && language !== DEFAULT_LANGUAGE) {
      template = await templateRepository.findActive({ event: templateEvent, channel, language: DEFAULT_LANGUAGE });
    }
    if (!template) return null;

    const vars = buildVariables(ctx);
    if (!vars.customer_name && accountId) {
      const account = await Account.findOne({ id: accountId });
      if (account && account.name) vars.customer_name = account.name;
    }

    return {
      subject: render(template.subject || '', vars),
      body: render(template.content || '', vars),
      templateId: template.id,
    };
  } catch (err) {
    console.error('[notificationTemplate] resolveContent failed', err.message);
    return null;
  }
}

module.exports = {
  validate,
  renderPreview,
  resolveContent,
  buildVariables,
  sanitizeOverrides,
  TemplateValidationError,
  TEMPLATE_EVENT_BY_NOTIFICATION_EVENT,
  SAMPLE_VARIABLES,
};
