const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Campaign = require('./Campaign');
const CampaignBanner = require('./CampaignBanner');

beforeAll(async () => {
  await connect();
  await Campaign.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Campaign model', () => {
  it('applies defaults: DRAFT status, ALL_CUSTOMERS target, Global (null branch)', async () => {
    const c = await Campaign.create({
      id: 1,
      name: 'Summer push',
      start_at: '2026-06-01',
      end_at: '2026-06-30',
    });
    expect(c.status).toBe('DRAFT');
    expect(c.target_type).toBe('ALL_CUSTOMERS');
    expect(c.branch_id).toBeNull();
    expect(c.movie_ids).toEqual([]);
    expect(c.promotion_ids).toEqual([]);
    expect(c.notification_enabled).toBe(false);
    expect(c.notification_sent_count).toBe(0);
  });

  it('requires name, start_at and end_at', () => {
    const err = new Campaign({}).validateSync();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.start_at).toBeDefined();
    expect(err.errors.end_at).toBeDefined();
  });

  it('rejects an unknown status or target_type', () => {
    const err = new Campaign({
      id: 2,
      name: 'x',
      start_at: '2026-06-01',
      end_at: '2026-06-30',
      status: 'LIVE',
      target_type: 'EVERYONE',
    }).validateSync();
    expect(err.errors.status).toBeDefined();
    expect(err.errors.target_type).toBeDefined();
  });
});

describe('CampaignBanner model', () => {
  it('requires title and image_url and defaults placement/status', () => {
    const err = new CampaignBanner({ id: 1, campaign_id: 1 }).validateSync();
    expect(err.errors.title).toBeDefined();
    expect(err.errors.image_url).toBeDefined();

    const ok = new CampaignBanner({ id: 1, campaign_id: 1, title: 'T', image_url: 'http://x/a.png' });
    expect(ok.validateSync()).toBeUndefined();
    expect(ok.placement).toBe('HOME_STRIP');
    expect(ok.status).toBe('ACTIVE');
    expect(ok.sort_order).toBe(0);
  });
});
