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
const reviewRoutes = require('./review.routes');
const dashboardRoutes = require('./dashboard.routes');
const employeeRoutes = require('./employee.routes');
const positionRoutes = require('./position.routes');
const shiftRoutes = require('./shift.routes');
const shiftAssignmentRoutes = require('./shiftAssignment.routes');
const pricingRuleRoutes = require('./pricingRule.routes');
const holidayRoutes = require('./holiday.routes');
const inventoryRoutes = require('./inventory.routes');

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
router.use('/review', reviewRoutes);
router.use('/employee', employeeRoutes);
router.use('/position', positionRoutes);
router.use('/shift', shiftRoutes);
router.use('/shiftAssignment', shiftAssignmentRoutes);
router.use('/pricingRule', pricingRuleRoutes);
router.use('/pricingHoliday', holidayRoutes);
router.use('/inventory', inventoryRoutes);
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
