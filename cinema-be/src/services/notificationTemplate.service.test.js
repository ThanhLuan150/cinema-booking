const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');

jest.mock('../models/Account', () => ({ findOne: jest.fn() }));

const templateService = require('./notificationTemplate.service');
const templateRepository = require('../repositories/notificationTemplate.repository');
const NotificationTemplate = require('../models/NotificationTemplate');
const Account = require('../models/Account');

beforeAll(async () => {
  await connect();
  await NotificationTemplate.init();
});
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

const { EVENT, CHANNEL, STATUS } = NotificationTemplate;

describe('notificationTemplate.service.validate', () => {
  const ok = {
    event: EVENT.TICKET_ISSUED,
    channel: CHANNEL.EMAIL,
    subject: 'Ticket for {{customer_name}}',
    content: 'Your ticket {{ticket_code}} for {{movie_name}} at {{showtime}}',
    language: 'vi',
    status: STATUS.ACTIVE,
  };

  it('accepts and normalises a well-formed template', () => {
    const out = templateService.validate(ok);
    expect(out).toMatchObject({ event: EVENT.TICKET_ISSUED, channel: CHANNEL.EMAIL, language: 'vi', status: 'ACTIVE' });
  });

  it('defaults language and status when omitted', () => {
    const out = templateService.validate({ event: EVENT.BOOKING_CANCELLED, channel: CHANNEL.IN_APP, content: 'x' });
    expect(out.language).toBe('vi');
    expect(out.status).toBe('ACTIVE');
  });

  it('rejects an unsupported channel (SMS) with CHANNEL_NOT_SUPPORTED', () => {
    try {
      templateService.validate({ ...ok, channel: 'SMS' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(templateService.TemplateValidationError);
      expect(err.status).toBe(400);
      expect(err.details.some((d) => d.code === 'CHANNEL_NOT_SUPPORTED')).toBe(true);
    }
  });

  it('requires a subject for EMAIL but not for IN_APP', () => {
    expect(() => templateService.validate({ ...ok, subject: '   ' })).toThrow(templateService.TemplateValidationError);
    expect(() =>
      templateService.validate({ event: EVENT.TICKET_ISSUED, channel: CHANNEL.IN_APP, content: 'ok {{movie_name}}' }),
    ).not.toThrow();
  });

  it('requires non-empty content', () => {
    expect(() => templateService.validate({ ...ok, content: '  ' })).toThrow(templateService.TemplateValidationError);
  });

  it('rejects a variable the event cannot provide', () => {
    try {
      // ticket_code is NOT allowed for BOOKING_SUCCESS
      templateService.validate({
        event: EVENT.BOOKING_SUCCESS,
        channel: CHANNEL.IN_APP,
        content: 'Hi {{customer_name}} code {{ticket_code}}',
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(templateService.TemplateValidationError);
      const detail = err.details.find((d) => d.code === 'UNKNOWN_VARIABLES');
      expect(detail.unknown).toEqual(['ticket_code']);
    }
  });
});

describe('notificationTemplate.service.renderPreview', () => {
  it('renders subject + content against sample data', () => {
    const out = templateService.renderPreview({
      subject: 'Hi {{customer_name}}',
      content: '{{movie_name}} at {{showtime}} - {{booking_code}}',
    });
    expect(out.subject).toBe('Hi Nguyen Van A');
    expect(out.content).toContain('Dune: Part Two');
    expect(out.content).toContain('BK-2X9F4');
    expect(out.variablesUsed).toEqual(expect.arrayContaining(['customer_name', 'movie_name', 'showtime', 'booking_code']));
  });

  it('lets a caller override sample values but ignores unsafe keys/values', () => {
    const out = templateService.renderPreview({
      content: '{{movie_name}}',
      variables: { movie_name: 'Custom Movie', 'bad-key': 'x', nested: { a: 1 } },
    });
    expect(out.content).toBe('Custom Movie');
  });
});

describe('notificationTemplate.service.resolveContent', () => {
  async function makeTemplate(overrides) {
    return templateRepository.create({
      event: EVENT.BOOKING_SUCCESS,
      channel: CHANNEL.IN_APP,
      subject: 'Booking OK {{customer_name}}',
      content: 'Booking {{booking_code}} for {{movie_name}} at {{branch_name}}',
      language: 'vi',
      status: STATUS.ACTIVE,
      ...overrides,
    });
  }

  it('renders an ACTIVE template, mapping the internal event name onto the template event', async () => {
    await makeTemplate();
    const out = await templateService.resolveContent({
      event: 'BOOKING_CREATED', // internal name -> BOOKING_SUCCESS
      channel: CHANNEL.IN_APP,
      ctx: { bookingCode: 'BK-9', movie: 'Dune', branch: 'CGV', customer_name: 'Lan' },
    });
    expect(out.subject).toBe('Booking OK Lan');
    expect(out.body).toBe('Booking BK-9 for Dune at CGV');
  });

  it('returns null when no template matches (caller keeps its built-in copy)', async () => {
    const out = await templateService.resolveContent({ event: 'BOOKING_CREATED', channel: CHANNEL.IN_APP, ctx: {} });
    expect(out).toBeNull();
  });

  it('ignores an INACTIVE template', async () => {
    await makeTemplate({ status: STATUS.INACTIVE });
    const out = await templateService.resolveContent({ event: 'BOOKING_CREATED', channel: CHANNEL.IN_APP, ctx: {} });
    expect(out).toBeNull();
  });

  it('never resolves for an unsupported channel', async () => {
    const out = await templateService.resolveContent({ event: 'BOOKING_CREATED', channel: 'SMS', ctx: {} });
    expect(out).toBeNull();
  });

  it('falls back to the default language when the requested one has no template', async () => {
    await makeTemplate({ language: 'vi' });
    const out = await templateService.resolveContent({
      event: 'BOOKING_CREATED',
      channel: CHANNEL.IN_APP,
      language: 'en',
      ctx: { bookingCode: 'BK-1', movie: 'M', branch: 'B', customer_name: 'X' },
    });
    expect(out.body).toBe('Booking BK-1 for M at B');
  });

  it('looks up the account name for {{customer_name}} when the context has none', async () => {
    await makeTemplate();
    Account.findOne.mockResolvedValueOnce({ id: 7, name: 'Tran Thi B' });
    const out = await templateService.resolveContent({
      event: 'BOOKING_CREATED',
      channel: CHANNEL.IN_APP,
      accountId: 7,
      ctx: { bookingCode: 'BK-2', movie: 'M', branch: 'B' },
    });
    expect(out.subject).toBe('Booking OK Tran Thi B');
  });

  it('never throws — a repository failure yields null', async () => {
    jest.spyOn(templateRepository, 'findActive').mockRejectedValueOnce(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      templateService.resolveContent({ event: 'BOOKING_CREATED', channel: CHANNEL.IN_APP, ctx: {} }),
    ).resolves.toBeNull();
    spy.mockRestore();
  });
});
