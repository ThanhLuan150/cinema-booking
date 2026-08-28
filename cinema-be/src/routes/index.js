const express = require('express');

const authRoutes = require('./auth.routes');
const movieRoutes = require('./movie.routes');
const categoryRoutes = require('./category.routes');
const movieCategoryRoutes = require('./movieCategory.routes');
const actorRoutes = require('./actor.routes');
const directorRoutes = require('./director.routes');
const movieActorRoutes = require('./movieActor.routes');
const movieDirectorRoutes = require('./movieDirector.routes');
const roomRoutes = require('./room.routes');
const scheduleRoutes = require('./schedule.routes');
const ticketRoutes = require('./ticket.routes');
const bookingRoutes = require('./booking.routes');
const paymentRoutes = require('./payment.routes');
const refundRoutes = require('./refund.routes');
const userRoutes = require('./user.routes');
const likeRoutes = require('./like.routes');
const branchRoutes = require('./branch.routes');
const companyRoutes = require('./company.routes');
const seatRoutes = require('./seat.routes');
const comboRoutes = require('./combo.routes');
const comboOrderRoutes = require('./comboOrder.routes');
const voucherRoutes = require('./voucher.routes');
const promotionRoutes = require('./promotion.routes');
const reviewRoutes = require('./review.routes');
const dashboardRoutes = require('./dashboard.routes');
const employeeRoutes = require('./employee.routes');
const positionRoutes = require('./position.routes');
const shiftRoutes = require('./shift.routes');
const shiftAssignmentRoutes = require('./shiftAssignment.routes');
const pricingRuleRoutes = require('./pricingRule.routes');
const holidayRoutes = require('./holiday.routes');
const inventoryRoutes = require('./inventory.routes');
const loyaltyRoutes = require('./loyalty.routes');
const maintenanceRequestRoutes = require('./maintenanceRequest.routes');
const supportTicketRoutes = require('./supportTicket.routes');
const entranceRoutes = require('./entrance.routes');
const deviceRoutes = require('./device.routes');
const auditLogRoutes = require('./auditLog.routes');
const notificationRoutes = require('./notification.routes');
const notificationTemplateRoutes = require('./notificationTemplate.routes');

const router = express.Router();

// Auth: /Login, /check-email, /register, /account, /users (create), /verify, /resend/:id
router.use('/', authRoutes);

// Resources
router.use('/movie', movieRoutes);
router.use('/cat', categoryRoutes);
router.use('/movieCat', movieCategoryRoutes);
router.use('/actor', actorRoutes);
router.use('/director', directorRoutes);
router.use('/movieActor', movieActorRoutes);
router.use('/movieDirector', movieDirectorRoutes);
router.use('/room', roomRoutes);
router.use('/schedule', scheduleRoutes);
router.use('/ticket', ticketRoutes);
// Branch management (formerly "Cinema"). Mounted at both paths: /cinema keeps the existing
// frontend (bookings, reviews, room/schedule management, etc.) working unchanged, /branch is
// the canonical path for the new Company/Branch admin surface introduced by this ticket.
router.use('/cinema', branchRoutes);
router.use('/branch', branchRoutes);
router.use('/company', companyRoutes);
router.use('/seat', seatRoutes);
router.use('/combo', comboRoutes);
router.use('/combo-orders', comboOrderRoutes);
router.use('/voucher', voucherRoutes);
router.use('/promotion', promotionRoutes);
router.use('/review', reviewRoutes);
router.use('/employee', employeeRoutes);
router.use('/position', positionRoutes);
router.use('/shift', shiftRoutes);
router.use('/shiftAssignment', shiftAssignmentRoutes);
router.use('/pricingRule', pricingRuleRoutes);
router.use('/pricingHoliday', holidayRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/maintenance', maintenanceRequestRoutes);
router.use('/support-tickets', supportTicketRoutes);
// QR Scanner device management: /entrance (branch entrances), /devices (scanners + check-in
// logs), and the device-authenticated /devices/checkin door endpoint.
router.use('/entrance', entranceRoutes);
router.use('/devices', deviceRoutes);
// Audit Log viewer (Ticket 24): read-only trail of important actions, gated by auditLog.read
// and branch-scoped for a Branch Admin.
router.use('/audit-logs', auditLogRoutes);
// Notification history (Ticket 25): a caller's own feed of booking/payment/showtime events,
// raised server-side by notification.service. Read + mark-read only.
router.use('/notifications', notificationRoutes);
// Notification Template management (Ticket 26): admin CRUD for the editable subject/content
// behind each notification event + channel + language, gated by notificationTemplate.*.
router.use('/notification-templates', notificationTemplateRoutes);
// Membership + Loyalty Points: /loyalty/me, /loyalty/me/transactions, /loyalty/redeem,
// /loyalty/config, /membership-levels
router.use('/', loyaltyRoutes);
router.use('/', dashboardRoutes);

// Booking flow: /scheduleId, /bookseat/:id, /bookticket/:id, /MomoPayment, /sendmail, /invoice
router.use('/', bookingRoutes);

// Payment lifecycle: /payments/my, /payments, /payments/:code/status, /payments/:id/refund/*
router.use('/', paymentRoutes);

// Refund workflow: /refunds, /refunds/my, /refunds/:id, /refunds/:id/{approve,reject,process,complete,fail}
router.use('/', refundRoutes);

// Admin users: /users, /block/:id, /unblock/:id
router.use('/', userRoutes);

// Likes: /like/:id, /like, /unlike
router.use('/', likeRoutes);

module.exports = router;
