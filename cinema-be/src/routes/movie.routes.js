const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const upload = require('../middleware/upload');
const movieController = require('../controllers/movie.controller');

const router = express.Router();

// GET /api/movie?search=&category=&country=&date=&cinema=
router.get('/', asyncHandler(movieController.list));

// GET /api/movie/mine -> management list (movie.read permission). Admin sees every movie;
// a theater owner only sees the movies they personally added. Must stay above GET /:id so
// "mine" isn't swallowed as an :id param.
router.get('/mine', requireAuth, requirePermission('movie.read'), asyncHandler(movieController.mine));

// GET /api/movie/:id
router.get('/:id', asyncHandler(movieController.getById));

const uploadMoviePoster = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'trailer', maxCount: 1 },
  { name: 'producerAvatar', maxCount: 1 },
]);

// POST /api/movie (movie.create permission)
router.post('/', requireAuth, requirePermission('movie.create'), uploadMoviePoster, asyncHandler(movieController.create));

// PUT /api/movie/:id (movie.update permission)
router.put('/:id', requireAuth, requirePermission('movie.update'), uploadMoviePoster, asyncHandler(movieController.update));

// DELETE /api/movie/:id (movie.delete permission)
router.delete('/:id', requireAuth, requirePermission('movie.delete'), asyncHandler(movieController.remove));

module.exports = router;
