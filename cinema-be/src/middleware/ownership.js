const cinemaRepository = require('../repositories/cinema.repository');

function requireCinemaOwnership(resolveCinemaId) {
  return async (req, res, next) => {
    try {
      const cinemaId = await resolveCinemaId(req);
      if (cinemaId === null || cinemaId === undefined || Number.isNaN(cinemaId)) {
        return res.status(404).json({ message: 'Cinema not found' });
      }

      if (req.permissionScope === 'ALL') {
        req.cinemaId = cinemaId;
        return next();
      }

      const cinema = await cinemaRepository.findById(cinemaId);
      if (!cinema) return res.status(404).json({ message: 'Cinema not found' });
      if (cinema.owner_id !== req.account.accountId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.cinemaId = cinemaId;
      req.cinema = cinema;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireCinemaOwnership };
