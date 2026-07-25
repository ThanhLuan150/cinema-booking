const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const movieController = require('../controllers/movie.controller');

const router = express.Router();

// GET /api/movie?search=&category=&country=&date=&cinema=
router.get('/', asyncHandler(movieController.list));

// GET /api/movie/mine -> management list (admin or theater staff). Admin sees every movie;
// a theater owner only sees the movies they personally added. Must stay above GET /:id so
// "mine" isn't swallowed as an :id param.
router.get('/mine', requireAuth, requireRole(0, 2), asyncHandler(movieController.mine));

// GET /api/movie/:id
router.get('/:id', asyncHandler(movieController.getById));

// POST /api/movie (admin or theater staff)
router.post('/', requireAuth, requireRole(0, 2), asyncHandler(movieController.create));

// PUT /api/movie/:id (admin or theater staff)
router.put('/:id', requireAuth, requireRole(0, 2), asyncHandler(movieController.update));

// DELETE /api/movie/:id (admin or theater staff)
router.delete('/:id', requireAuth, requireRole(0, 2), asyncHandler(movieController.remove));

module.exports = router;
