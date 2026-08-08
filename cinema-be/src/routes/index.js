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
const userRoutes = require('./user.routes');
const likeRoutes = require('./like.routes');
const cinemaRoutes = require('./cinema.routes');
const seatRoutes = require('./seat.routes');
const comboRoutes = require('./combo.routes');
const voucherRoutes = require('./voucher.routes');
const reviewRoutes = require('./review.routes');
const dashboardRoutes = require('./dashboard.routes');
const employeeRoutes = require('./employee.routes');

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
router.use('/cinema', cinemaRoutes);
router.use('/seat', seatRoutes);
router.use('/combo', comboRoutes);
router.use('/voucher', voucherRoutes);
router.use('/review', reviewRoutes);
router.use('/employee', employeeRoutes);
router.use('/', dashboardRoutes);

// Booking flow: /scheduleId, /bookseat/:id, /bookticket/:id, /MomoPayment, /sendmail, /invoice
router.use('/', bookingRoutes);

// Admin users: /users, /block/:id, /unblock/:id
router.use('/', userRoutes);

// Likes: /like/:id, /like, /unlike
router.use('/', likeRoutes);

module.exports = router;
