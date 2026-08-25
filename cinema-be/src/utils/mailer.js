const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    // No SMTP configured: log emails to the console so local dev still works.
    transporter = {
      sendMail: async (options) => {
        console.log('--- [mailer] SMTP not configured, logging email instead ---');
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(options.text || options.html);
        console.log('------------------------------------------------------------');
        return { messageId: 'console-log' };
      },
    };
  }

  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || 'Cinema Booking <no-reply@cinema.local>';
  return getTransporter().sendMail({ from, to, subject, text, html });
}

async function sendOtpEmail(email, otp) {
  return sendMail({
    to: email,
    subject: 'Cinema Booking - Verification code',
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
  });
}

async function sendPasswordResetEmail(email, otp) {
  return sendMail({
    to: email,
    subject: 'Cinema Booking - Password reset code',
    text: `Your password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
  });
}

async function sendTempPasswordEmail(email, tempPassword) {
  return sendMail({
    to: email,
    subject: 'Cinema Booking - Your password has been reset',
    text: `Your account password was reset by a branch admin. Your new temporary password is: ${tempPassword}. Please sign in and change it as soon as possible.`,
  });
}

async function sendInvoiceEmail(email, { seats, schedule_id, price }) {
  return sendMail({
    to: email,
    subject: 'Cinema Booking - Your invoice',
    text: `Booking confirmed for schedule #${schedule_id}. Seats: ${Array.isArray(seats) ? seats.join(', ') : seats}. Total price: ${price}.`,
  });
}

async function sendShowtimeCancelledEmail(email, { movieName, movie_date, time_begin }) {
  return sendMail({
    to: email,
    subject: 'Cinema Booking - Your showtime was cancelled',
    text: `The showtime for "${movieName}" on ${movie_date} at ${time_begin} has been cancelled by the cinema. Your booking has been cancelled and, if paid, a refund request has been raised for staff to process.`,
  });
}

async function sendShowtimeRescheduledEmail(email, { movieName, oldDate, oldTime, newDate, newTime }) {
  return sendMail({
    to: email,
    subject: 'Cinema Booking - Your showtime was rescheduled',
    text: `The showtime for "${movieName}" has moved from ${oldDate} ${oldTime} to ${newDate} ${newTime}. Please sign in to accept the new time or request a refund.`,
  });
}

module.exports = {
  sendMail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendTempPasswordEmail,
  sendInvoiceEmail,
  sendShowtimeCancelledEmail,
  sendShowtimeRescheduledEmail,
};
