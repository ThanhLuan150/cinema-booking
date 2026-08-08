const movieRepository = require('../repositories/movie.repository');

// A role-2 caller may only touch a movie they created; admin (role 0) always passes.
// Shared by movie.controller.js and the movieCategory/movieActor/movieDirector
// controllers, since tagging a movie's categories/cast is part of editing that movie.
async function assertMovieOwnership(req, movieId) {
  if (req.account.role === 0) return true;
  if (!movieId) return false;
  const movie = await movieRepository.findById(movieId);
  return Boolean(movie && movie.owner_id === req.account.accountId);
}

module.exports = { assertMovieOwnership };
