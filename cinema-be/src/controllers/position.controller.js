const positionRepository = require('../repositories/position.repository');

// GET /api/position -> active positions
async function list(req, res) {
  const positions = await positionRepository.findAll({ activeOnly: true });
  res.json(positions);
}

module.exports = { list };
