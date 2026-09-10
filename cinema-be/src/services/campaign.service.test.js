const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Campaign = require('../models/Campaign');
const CampaignBanner = require('../models/CampaignBanner');
const Account = require('../models/Account');
const Movie = require('../models/Movie');
const Notification = require('../models/Notification');
const campaignService = require('./campaign.service');

beforeAll(async () => {
  await connect();
  await Promise.all([Campaign.init(), Notification.init()]);
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const WINDOW = { start_at: new Date(Date.now() - 86400_000), end_at: new Date(Date.now() + 86400_000) };
const PAST = { start_at: new Date(Date.now() - 172800_000), end_at: new Date(Date.now() - 86400_000) };

async function customer(id, extra = {}) {
  return Account.create({ id, email: `c${id}@x.com`, password: 'h', role: 1, status: 1, verified: true, ...extra });
}

describe('resolveVisibleCampaigns', () => {
  it('returns a running campaign with its ACTIVE banners, and hides expired / draft ones', async () => {
    await Campaign.create({ id: 1, name: 'Running', status: 'ACTIVE', ...WINDOW });
    await Campaign.create({ id: 2, name: 'Expired', status: 'ACTIVE', ...PAST });
    await Campaign.create({ id: 3, name: 'Draft', status: 'DRAFT', ...WINDOW });
    await CampaignBanner.create({ id: 1, campaign_id: 1, title: 'Hero', image_url: 'http://x/h.png', status: 'ACTIVE' });
    await CampaignBanner.create({ id: 2, campaign_id: 1, title: 'Off', image_url: 'http://x/o.png', status: 'INACTIVE' });

    const feed = await campaignService.resolveVisibleCampaigns({ branchId: null });
    expect(feed.map((c) => c.id)).toEqual([1]);
    expect(feed[0].banners).toHaveLength(1);
    expect(feed[0].banners[0].title).toBe('Hero');
  });

  it('scopes branch campaigns to the branch, always includes Global, and resolves linked movies', async () => {
    await Movie.create({ id: 10, name: 'Linked Movie', premiere_date: '2026-01-01' });
    await Campaign.create({ id: 1, name: 'Global', status: 'ACTIVE', branch_id: null, movie_ids: [10], ...WINDOW });
    await Campaign.create({ id: 2, name: 'Branch 7', status: 'ACTIVE', branch_id: 7, ...WINDOW });
    await Campaign.create({ id: 3, name: 'Branch 9', status: 'ACTIVE', branch_id: 9, ...WINDOW });

    const feed = await campaignService.resolveVisibleCampaigns({ branchId: 7 });
    expect(feed.map((c) => c.id).sort()).toEqual([1, 2]);
    const global = feed.find((c) => c.id === 1);
    expect(global.movies).toEqual([expect.objectContaining({ id: 10, name: 'Linked Movie' })]);
  });

  it('drops a campaign that has no banner for the requested placement', async () => {
    await Campaign.create({ id: 1, name: 'Has hero', status: 'ACTIVE', ...WINDOW });
    await Campaign.create({ id: 2, name: 'No hero', status: 'ACTIVE', ...WINDOW });
    await CampaignBanner.create({ id: 1, campaign_id: 1, title: 'H', image_url: 'http://x/h.png', placement: 'HOME_HERO' });
    await CampaignBanner.create({ id: 2, campaign_id: 2, title: 'S', image_url: 'http://x/s.png', placement: 'HOME_STRIP' });

    const feed = await campaignService.resolveVisibleCampaigns({ branchId: null, placement: 'HOME_HERO' });
    expect(feed.map((c) => c.id)).toEqual([1]);
  });
});

describe('dispatchCampaignNotification', () => {
  it('refuses when the campaign is not currently running', async () => {
    const c = await Campaign.create({
      id: 1,
      name: 'Expired',
      status: 'ACTIVE',
      notification_enabled: true,
      notification_title: 'Hi',
      ...PAST,
    });
    const res = await campaignService.dispatchCampaignNotification(c);
    expect(res.code).toBe(campaignService.DISPATCH_ERROR.NOT_RUNNING);
  });

  it('refuses when notifications are disabled or have no title', async () => {
    const disabled = await Campaign.create({ id: 1, name: 'A', status: 'ACTIVE', ...WINDOW });
    expect((await campaignService.dispatchCampaignNotification(disabled)).code).toBe(
      campaignService.DISPATCH_ERROR.NOTIFICATION_DISABLED,
    );
    const empty = await Campaign.create({
      id: 2,
      name: 'B',
      status: 'ACTIVE',
      notification_enabled: true,
      ...WINDOW,
    });
    expect((await campaignService.dispatchCampaignNotification(empty)).code).toBe(
      campaignService.DISPATCH_ERROR.NOTIFICATION_EMPTY,
    );
  });

  it('sends to every targeted customer once, and a second dispatch notifies nobody again', async () => {
    await customer(1);
    await customer(2);
    await customer(3, { status: 0 }); // blocked — never targeted
    const c = await Campaign.create({
      id: 1,
      name: 'Blast',
      status: 'ACTIVE',
      target_type: 'ALL_CUSTOMERS',
      notification_enabled: true,
      notification_title: 'Big weekend',
      notification_body: '2 for 1 on all tickets',
      ...WINDOW,
    });

    const first = await campaignService.dispatchCampaignNotification(c);
    expect(first).toEqual({ audience: 2, sent: 2, skipped: 0 });

    const rows = await Notification.find({ type: 'CAMPAIGN_ANNOUNCEMENT' });
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Big weekend');
    expect(rows[0].dedupe_key).toBe(campaignService.dedupeKeyFor(1, rows[0].account_id));

    const second = await campaignService.dispatchCampaignNotification(c);
    expect(second).toEqual({ audience: 2, sent: 0, skipped: 2 });
    expect(await Notification.countDocuments({ type: 'CAMPAIGN_ANNOUNCEMENT' })).toBe(2);
  });

  it('MEMBERS target only reaches customers above tier NONE', async () => {
    await customer(1, { membership_level: 'GOLD' });
    await customer(2, { membership_level: 'NONE' });
    const c = await Campaign.create({
      id: 1,
      name: 'VIP',
      status: 'ACTIVE',
      target_type: 'MEMBERS',
      notification_enabled: true,
      notification_title: 'Members only',
      ...WINDOW,
    });
    const res = await campaignService.dispatchCampaignNotification(c);
    expect(res).toEqual({ audience: 1, sent: 1, skipped: 0 });
  });
});
