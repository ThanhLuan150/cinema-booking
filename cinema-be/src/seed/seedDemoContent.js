/**
 * Lightweight demo-content top-up for eyeballing the home + notification UI:
 *   - flags the newest ACTIVE movies as `featured` so FeaturedMoviesSection has a rail to show
 *   - drops a spread of notifications onto every customer account so the bell / Notifications
 *     page render with real content
 *
 *   node src/seed/seedDemoContent.js
 *
 * Idempotent: notifications are keyed `DEMO-NOTE-<accountId>-<n>`; re-running upserts nothing new.
 */
require('dotenv').config();

const connectDB = require('../config/db');
const Account = require('../models/Account');
const Movie = require('../models/Movie');
const Notification = require('../models/Notification');

const FEATURED_COUNT = 4;

async function markFeatured() {
  const movies = await Movie.find({ status: { $ne: 'INACTIVE' } }).sort({ id: -1 }).limit(FEATURED_COUNT);
  if (movies.length === 0) {
    console.log('No ACTIVE movies to feature — run `node src/seed/seedMovies.js` first.');
    return;
  }
  await Movie.updateMany({ id: { $in: movies.map((m) => m.id) } }, { $set: { featured: true } });
  console.log(`Featured ${movies.length} movie(s): ${movies.map((m) => m.name).join(', ')}`);
}

function notificationsFor(accountId, movieName, branchName) {
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };
  const rows = [
    {
      type: 'PAYMENT_SUCCESS',
      title: 'Thanh toán thành công',
      body: `Đơn đặt vé "${movieName}" đã thanh toán 180.000đ.`,
      read: day(-6),
    },
    {
      type: 'TICKET_ISSUED',
      title: 'Vé của bạn đã sẵn sàng',
      body: `2 vé xem "${movieName}" tại ${branchName}. Xuất trình mã QR tại cửa vào.`,
      read: day(-6),
    },
    {
      type: 'BOOKING_CREATED',
      title: 'Đặt vé thành công',
      body: `Đơn đặt vé cho "${movieName}" đã được tạo, vui lòng thanh toán trong 10 phút.`,
      read: null,
    },
    {
      type: 'SHOWTIME_CHANGED',
      title: 'Suất chiếu đổi giờ',
      body: `Suất "${movieName}" được dời sang 19:30 cùng ngày.`,
      read: null,
    },
    {
      type: 'SHOWTIME_CANCELLED',
      title: 'Suất chiếu bị huỷ',
      body: `Rất tiếc, suất "${movieName}" ngày mai đã bị huỷ. Bạn sẽ được hoàn tiền tự động.`,
      read: null,
    },
    {
      type: 'REFUND_COMPLETED',
      title: 'Hoàn tiền thành công',
      body: `Đã hoàn 144.000đ về phương thức thanh toán của bạn.`,
      read: null,
    },
    {
      type: 'BOOKING_CANCELLED',
      title: 'Đơn đặt vé đã huỷ',
      body: `Đơn đặt vé "${movieName}" đã được huỷ theo yêu cầu.`,
      read: day(-1),
    },
  ];
  return rows.map((r, i) => ({
    account_id: accountId,
    type: r.type,
    title: r.title,
    body: r.body,
    data: { movie: movieName, branch: branchName },
    channels: ['IN_APP'],
    status: 'SENT',
    sent_at: day(-i),
    read_at: r.read,
    dedupe_key: `DEMO-NOTE-${accountId}-${i}`,
  }));
}

async function seedNotifications() {
  const customers = await Account.find({ role: 1 }).select('id').lean();
  if (customers.length === 0) {
    console.log('No customer accounts found.');
    return;
  }
  const movie = await Movie.findOne({ status: { $ne: 'INACTIVE' } }).sort({ id: -1 });
  const movieName = movie ? movie.name : 'Phim đang chiếu';
  const branchName = 'CineNova Central';

  let created = 0;
  let nextId = ((await Notification.findOne().sort({ id: -1 }).select('id').lean())?.id || 0) + 1;

  for (const c of customers) {
    for (const doc of notificationsFor(c.id, movieName, branchName)) {
      const exists = await Notification.findOne({ dedupe_key: doc.dedupe_key });
      if (exists) continue;
      await Notification.create({ id: nextId, ...doc });
      nextId += 1;
      created += 1;
    }
  }
  console.log(`Created ${created} notification(s) across ${customers.length} customer account(s).`);
}

async function run() {
  await connectDB();
  await markFeatured();
  await seedNotifications();
  console.log('Demo content top-up complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
