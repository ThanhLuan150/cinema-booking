const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authRepository = require('../repositories/auth.repository');
const nextId = require('../utils/nextId');
const { generateOtp, otpExpiryDate } = require('../utils/otp');
const { sendOtpEmail, sendPasswordResetEmail } = require('../utils/mailer');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('../utils/tokens');

const REFRESH_COOKIE_NAME = 'refreshToken';
// The frontend and backend are separate origins (different ports/hosts in dev,
// typically different subdomains in production), so the cookie must survive
// cross-site XHR — that requires SameSite=None, which in turn requires Secure.
// Chromium treats http://localhost and http://127.0.0.1 as secure contexts, so
// this still works without TLS in local dev.
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/api',
};

function isOtpValid(account, otp) {
  return Boolean(account.otp && account.otp === otp && account.otpExpiresAt && account.otpExpiresAt.getTime() > Date.now());
}

// Signs a fresh access+refresh pair, persists the refresh token's hash for
// rotation/revocation, and sets the httpOnly refresh cookie on the response.
async function issueTokens(res, account) {
  const accessToken = signAccessToken(account);
  const refreshToken = signRefreshToken(account);
  const { exp } = jwt.decode(refreshToken);
  const expiresAt = new Date(exp * 1000);

  await authRepository.setRefreshToken(account.id, hashToken(refreshToken), expiresAt);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: expiresAt.getTime() - Date.now(),
  });

  return accessToken;
}

// POST /api/Login
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const account = await authRepository.findByEmailForLogin(email);
  if (!account) {
    return res.status(401).json({ message: 'Account does not exist', code: 'ACCOUNT_NOT_FOUND' });
  }
  if (!account.verified) {
    return res.status(403).json({ message: 'Account is not verified yet', code: 'ACCOUNT_NOT_VERIFIED' });
  }
  if (account.status === 0) {
    return res.status(403).json({ message: 'Account has been locked', code: 'ACCOUNT_LOCKED' });
  }
  if (account.role === 2 && !account.approved) {
    return res
      .status(403)
      .json({ message: 'Theater account is pending admin approval', code: 'ACCOUNT_PENDING_APPROVAL' });
  }

  const match = await bcrypt.compare(password, account.password);
  if (!match) {
    return res.status(401).json({ message: 'Incorrect password', code: 'INVALID_PASSWORD' });
  }

  const accessToken = await issueTokens(res, account);

  res.json({
    accessToken,
    account: { id: account.id, email: account.email },
    user_id: String(account.id),
    role: String(account.role),
  });
}

// POST /api/refresh-token (reads refreshToken httpOnly cookie)
async function refreshToken(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: 'Missing refresh token' });
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }

  const account = await authRepository.findByIdWithRefreshToken(payload.accountId);
  const presentedHash = hashToken(token);
  const isValid =
    account &&
    account.refreshTokenHash === presentedHash &&
    account.refreshTokenExpiresAt &&
    account.refreshTokenExpiresAt.getTime() > Date.now();

  if (!isValid) {
    // Token reuse/mismatch: revoke whatever is stored so a stolen token can't be replayed.
    if (account) await authRepository.clearRefreshToken(account.id);
    res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }

  const accessToken = await issueTokens(res, account);
  res.json({ accessToken });
}

// POST /api/logout (clears the refreshToken httpOnly cookie)
async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await authRepository.clearRefreshToken(payload.accountId);
    } catch (err) {
      // Already invalid/expired — nothing to revoke.
    }
  }
  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
  res.status(204).end();
}

// GET /api/check-email?email=
async function checkEmail(req, res) {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'email query param is required' });

  const account = await authRepository.findByEmail(email);
  res.json({ exists: !!account });
}

// POST /api/register
async function register(req, res) {
  const { email, password, c_password, role } = req.body;
  if (!email || !password || !c_password) {
    return res.status(400).json({ message: 'email, password and c_password are required' });
  }
  if (password !== c_password) {
    return res.status(400).json({ message: 'Password confirmation does not match', code: 'PASSWORD_MISMATCH' });
  }

  // Public registration may only self-assign "user" (1) or "theater staff" (2); admin (0) is provisioned separately.
  const requestedRole = Number(role);
  const normalizedRole = [1, 2].includes(requestedRole) ? requestedRole : 1;

  const normalizedEmail = email.toLowerCase();
  let account = await authRepository.findByEmailWithPassword(normalizedEmail);

  if (account && account.verified) {
    return res.status(409).json({ message: 'Email already exists', code: 'EMAIL_ALREADY_EXISTS' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const otp = generateOtp();
  const otpExpiresAt = otpExpiryDate();

  const approved = normalizedRole !== 2;

  if (account) {
    account.password = hashed;
    account.role = normalizedRole;
    account.approved = approved;
    account.otp = otp;
    account.otpExpiresAt = otpExpiresAt;
    await authRepository.saveAccount(account);
  } else {
    const id = await nextId('account');
    account = await authRepository.createAccount({
      id,
      email: normalizedEmail,
      password: hashed,
      role: normalizedRole,
      approved,
      verified: false,
      otp,
      otpExpiresAt,
    });
  }

  await sendOtpEmail(normalizedEmail, otp);

  res.status(201).json({
    message: 'Registration successful, please check your email',
    code: 'REGISTER_SUCCESS',
    account_id: account.id,
  });
}

// GET /api/account/:email
async function getAccountByEmailParam(req, res) {
  const account = await authRepository.findByEmail(req.params.email);
  if (!account) return res.status(404).json({ message: 'Account not found' });
  res.json({ id: account.id, email: account.email });
}

// GET /api/account?email=
async function listAccounts(req, res) {
  const { email } = req.query;
  const filter = email ? { email: String(email).toLowerCase() } : {};
  const accounts = await authRepository.findByFilter(filter);
  res.json(accounts.map((a) => ({ id: a.id, email: a.email })));
}

// POST /api/users  (save user profile info after verification)
async function saveProfile(req, res) {
  const { name, phone, email } = req.body;
  if (!name || !phone || !email) {
    return res.status(400).json({ message: 'name, phone and email are required' });
  }

  const account = await authRepository.updateProfileByEmail(email, { name, phone });
  if (!account) return res.status(404).json({ message: 'Account not found' });

  res.status(201).json(account);
}

// POST /api/verify
async function verify(req, res) {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'email and otp are required' });

  const account = await authRepository.findByEmailWithOtp(email);
  if (!account) return res.status(404).json({ message: 'Account not found' });

  if (!isOtpValid(account, otp)) {
    return res
      .status(400)
      .json({ message: 'Verification code is invalid or has expired', code: 'OTP_INVALID_OR_EXPIRED' });
  }

  account.verified = true;
  account.otp = null;
  account.otpExpiresAt = null;
  await authRepository.saveAccount(account);

  res.json({ message: 'Verification successful', code: 'VERIFY_SUCCESS' });
}

// POST /api/forgot-password { email }
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'email is required' });

  const account = await authRepository.findByEmail(email);
  if (!account) return res.status(404).json({ message: 'Account does not exist', code: 'ACCOUNT_NOT_FOUND' });

  account.otp = generateOtp();
  account.otpExpiresAt = otpExpiryDate();
  await authRepository.saveAccount(account);

  await sendPasswordResetEmail(account.email, account.otp);

  res.json({
    message: 'Password reset code sent, please check your email',
    code: 'RESET_CODE_SENT',
  });
}

// POST /api/reset-password { email, otp, password, c_password }
async function resetPassword(req, res) {
  const { email, otp, password, c_password } = req.body;
  if (!email || !otp || !password || !c_password) {
    return res.status(400).json({ message: 'email, otp, password and c_password are required' });
  }
  if (password !== c_password) {
    return res.status(400).json({ message: 'Password confirmation does not match', code: 'PASSWORD_MISMATCH' });
  }

  const account = await authRepository.findByEmailWithOtpAndPassword(email);
  if (!account) return res.status(404).json({ message: 'Account not found' });

  if (!isOtpValid(account, otp)) {
    return res
      .status(400)
      .json({ message: 'Verification code is invalid or has expired', code: 'OTP_INVALID_OR_EXPIRED' });
  }

  account.password = await bcrypt.hash(password, 10);
  account.otp = null;
  account.otpExpiresAt = null;
  await authRepository.saveAccount(account);

  res.json({ message: 'Password reset successful', code: 'RESET_PASSWORD_SUCCESS' });
}

// POST /api/change-password { currentPassword, newPassword, c_password } (auth required)
async function changePassword(req, res) {
  const { currentPassword, newPassword, c_password } = req.body;
  if (!currentPassword || !newPassword || !c_password) {
    return res.status(400).json({ message: 'currentPassword, newPassword and c_password are required' });
  }
  if (newPassword !== c_password) {
    return res.status(400).json({ message: 'Password confirmation does not match', code: 'PASSWORD_MISMATCH' });
  }

  const account = await authRepository.findByIdWithPassword(req.account.accountId);
  if (!account) return res.status(404).json({ message: 'Account not found' });

  const match = await bcrypt.compare(currentPassword, account.password);
  if (!match)
    return res.status(401).json({ message: 'Current password is incorrect', code: 'CURRENT_PASSWORD_INVALID' });

  account.password = await bcrypt.hash(newPassword, 10);
  await authRepository.saveAccount(account);

  res.json({ message: 'Password changed successfully', code: 'CHANGE_PASSWORD_SUCCESS' });
}

// POST /api/resend/:accountId
async function resendOtp(req, res) {
  const account = await authRepository.findById(req.params.accountId);
  if (!account) return res.status(404).json({ message: 'Account not found' });

  account.otp = generateOtp();
  account.otpExpiresAt = otpExpiryDate();
  await authRepository.saveAccount(account);

  await sendOtpEmail(account.email, account.otp);

  res.json({ message: 'Verification code resent', code: 'OTP_RESENT' });
}

module.exports = {
  login,
  refreshToken,
  logout,
  checkEmail,
  register,
  getAccountByEmailParam,
  listAccounts,
  saveProfile,
  verify,
  forgotPassword,
  resetPassword,
  changePassword,
  resendOtp,
};
