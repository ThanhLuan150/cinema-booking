const NotificationTemplate = require('../models/NotificationTemplate');
const nextId = require('../utils/nextId');

// Ticket 26 — a starter set of notification templates so a fresh install renders branded copy
// instead of the built-in fallback. Idempotent: an existing (event, channel, language) row is
// left untouched. Only the channels this deployment can deliver (EMAIL, IN_APP) are seeded.

const { EVENT, CHANNEL, STATUS } = NotificationTemplate;

// [event, { email: {subject, content}, inApp: {subject, content} }] for vi + en.
const TEMPLATES = [
  {
    event: EVENT.BOOKING_SUCCESS,
    vi: {
      email: {
        subject: 'Đặt vé thành công - {{movie_name}}',
        content:
          'Xin chào {{customer_name}},\n\nChúng tôi đã ghi nhận đơn đặt vé {{booking_code}} cho phim "{{movie_name}}" tại {{branch_name}} ({{room_name}}), suất chiếu {{showtime}}, ghế {{seat}}.\n\nCảm ơn bạn đã đặt vé!',
      },
      inApp: {
        subject: 'Đặt vé thành công',
        content: 'Đơn {{booking_code}} cho "{{movie_name}}" suất {{showtime}} đã được ghi nhận.',
      },
    },
    en: {
      email: {
        subject: 'Booking confirmed - {{movie_name}}',
        content:
          'Hi {{customer_name}},\n\nWe received your booking {{booking_code}} for "{{movie_name}}" at {{branch_name}} ({{room_name}}), showtime {{showtime}}, seat(s) {{seat}}.\n\nThank you for booking with us!',
      },
      inApp: {
        subject: 'Booking confirmed',
        content: 'Booking {{booking_code}} for "{{movie_name}}" at {{showtime}} has been received.',
      },
    },
  },
  {
    event: EVENT.PAYMENT_SUCCESS,
    vi: {
      email: {
        subject: 'Thanh toán thành công - {{movie_name}}',
        content:
          'Xin chào {{customer_name}},\n\nThanh toán cho đơn {{booking_code}} ("{{movie_name}}", suất {{showtime}}) đã thành công. Ghế: {{seat}}.',
      },
      inApp: { subject: 'Thanh toán thành công', content: 'Đơn {{booking_code}} đã được thanh toán.' },
    },
    en: {
      email: {
        subject: 'Payment successful - {{movie_name}}',
        content:
          'Hi {{customer_name}},\n\nPayment for booking {{booking_code}} ("{{movie_name}}", showtime {{showtime}}) was successful. Seat(s): {{seat}}.',
      },
      inApp: { subject: 'Payment successful', content: 'Booking {{booking_code}} has been paid.' },
    },
  },
  {
    event: EVENT.TICKET_ISSUED,
    vi: {
      email: {
        subject: 'Vé của bạn đã sẵn sàng - {{movie_name}}',
        content:
          'Xin chào {{customer_name}},\n\nVé cho "{{movie_name}}" tại {{branch_name}} ({{room_name}}), suất {{showtime}}, ghế {{seat}} đã sẵn sàng.\nMã vé: {{ticket_code}}\nMã đơn: {{booking_code}}',
      },
      inApp: { subject: 'Vé đã sẵn sàng', content: 'Vé {{ticket_code}} cho "{{movie_name}}" suất {{showtime}} đã sẵn sàng.' },
    },
    en: {
      email: {
        subject: 'Your ticket is ready - {{movie_name}}',
        content:
          'Hi {{customer_name}},\n\nYour ticket for "{{movie_name}}" at {{branch_name}} ({{room_name}}), showtime {{showtime}}, seat(s) {{seat}} is ready.\nTicket code: {{ticket_code}}\nBooking code: {{booking_code}}',
      },
      inApp: { subject: 'Ticket ready', content: 'Ticket {{ticket_code}} for "{{movie_name}}" at {{showtime}} is ready.' },
    },
  },
  {
    event: EVENT.BOOKING_CANCELLED,
    vi: {
      email: {
        subject: 'Đơn đặt vé đã bị huỷ - {{movie_name}}',
        content:
          'Xin chào {{customer_name}},\n\nĐơn {{booking_code}} cho "{{movie_name}}" (suất {{showtime}}) đã bị huỷ.',
      },
      inApp: { subject: 'Đơn đã bị huỷ', content: 'Đơn {{booking_code}} cho "{{movie_name}}" đã bị huỷ.' },
    },
    en: {
      email: {
        subject: 'Your booking was cancelled - {{movie_name}}',
        content: 'Hi {{customer_name}},\n\nBooking {{booking_code}} for "{{movie_name}}" (showtime {{showtime}}) has been cancelled.',
      },
      inApp: { subject: 'Booking cancelled', content: 'Booking {{booking_code}} for "{{movie_name}}" has been cancelled.' },
    },
  },
  {
    event: EVENT.REFUND_SUCCESS,
    vi: {
      email: {
        subject: 'Hoàn tiền thành công - {{movie_name}}',
        content:
          'Xin chào {{customer_name}},\n\nYêu cầu hoàn tiền cho đơn {{booking_code}} ("{{movie_name}}", suất {{showtime}}) đã được xử lý xong.',
      },
      inApp: { subject: 'Hoàn tiền thành công', content: 'Đơn {{booking_code}} đã được hoàn tiền.' },
    },
    en: {
      email: {
        subject: 'Refund completed - {{movie_name}}',
        content:
          'Hi {{customer_name}},\n\nThe refund for booking {{booking_code}} ("{{movie_name}}", showtime {{showtime}}) has been completed.',
      },
      inApp: { subject: 'Refund completed', content: 'Booking {{booking_code}} has been refunded.' },
    },
  },
  {
    event: EVENT.SHOWTIME_CANCELLED,
    vi: {
      email: {
        subject: 'Suất chiếu đã bị huỷ - {{movie_name}}',
        content:
          'Xin chào {{customer_name}},\n\nSuất chiếu "{{movie_name}}" tại {{branch_name}} ({{room_name}}) lúc {{showtime}} đã bị huỷ. Đơn {{booking_code}} của bạn đã được huỷ và sẽ được hoàn tiền nếu đã thanh toán.',
      },
      inApp: { subject: 'Suất chiếu bị huỷ', content: 'Suất "{{movie_name}}" lúc {{showtime}} đã bị huỷ (đơn {{booking_code}}).' },
    },
    en: {
      email: {
        subject: 'Showtime cancelled - {{movie_name}}',
        content:
          'Hi {{customer_name}},\n\nThe showtime for "{{movie_name}}" at {{branch_name}} ({{room_name}}) on {{showtime}} has been cancelled. Your booking {{booking_code}} has been cancelled and, if paid, will be refunded.',
      },
      inApp: { subject: 'Showtime cancelled', content: 'The "{{movie_name}}" showtime at {{showtime}} was cancelled (booking {{booking_code}}).' },
    },
  },
  {
    event: EVENT.SHOWTIME_CHANGED,
    vi: {
      email: {
        subject: 'Suất chiếu đã thay đổi - {{movie_name}}',
        content:
          'Xin chào {{customer_name}},\n\nSuất chiếu "{{movie_name}}" tại {{branch_name}} đã được đổi sang {{showtime}}. Vui lòng kiểm tra lại đơn {{booking_code}}.',
      },
      inApp: { subject: 'Suất chiếu thay đổi', content: 'Suất "{{movie_name}}" đã đổi sang {{showtime}} (đơn {{booking_code}}).' },
    },
    en: {
      email: {
        subject: 'Showtime changed - {{movie_name}}',
        content:
          'Hi {{customer_name}},\n\nThe showtime for "{{movie_name}}" at {{branch_name}} has moved to {{showtime}}. Please review your booking {{booking_code}}.',
      },
      inApp: { subject: 'Showtime changed', content: 'The "{{movie_name}}" showtime moved to {{showtime}} (booking {{booking_code}}).' },
    },
  },
];

async function upsert({ event, channel, language, subject, content }) {
  const existing = await NotificationTemplate.findOne({ event, channel, language });
  if (existing) return;
  const id = await nextId('notificationTemplate');
  await NotificationTemplate.create({
    id,
    event,
    channel,
    language,
    subject,
    content,
    status: STATUS.ACTIVE,
    description: 'Seeded default template',
  });
  console.log(`Created notification template: ${event} / ${channel} / ${language}`);
}

async function seedNotificationTemplates() {
  for (const row of TEMPLATES) {
    for (const language of ['vi', 'en']) {
      const set = row[language];
      if (!set) continue;
      await upsert({ event: row.event, channel: CHANNEL.EMAIL, language, ...set.email });
      await upsert({ event: row.event, channel: CHANNEL.IN_APP, language, ...set.inApp });
    }
  }
  console.log('Notification template seed complete.');
}

module.exports = seedNotificationTemplates;
