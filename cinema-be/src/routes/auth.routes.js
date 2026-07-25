const express = require('express');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// POST /api/Login
router.post('/Login', asyncHandler(authController.login));

// GET /api/check-email?email=
router.get('/check-email', asyncHandler(authController.checkEmail));

// POST /api/register
router.post('/register', asyncHandler(authController.register));

// GET /api/account/:email
router.get('/account/:email', asyncHandler(authController.getAccountByEmailParam));

// GET /api/account?email=
router.get('/account', asyncHandler(authController.listAccounts));

// POST /api/users  (save user profile info after verification)
router.post('/users', asyncHandler(authController.saveProfile));

// POST /api/verify
router.post('/verify', asyncHandler(authController.verify));

// POST /api/forgot-password { email }
router.post('/forgot-password', asyncHandler(authController.forgotPassword));

// POST /api/reset-password { email, otp, password, c_password }
router.post('/reset-password', asyncHandler(authController.resetPassword));

// POST /api/change-password { currentPassword, newPassword, c_password } (auth required)
router.post('/change-password', requireAuth, asyncHandler(authController.changePassword));

// POST /api/resend/:accountId
router.post('/resend/:accountId', asyncHandler(authController.resendOtp));

module.exports = router;
