require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./utils/socket');
const { startSeatHoldSweep } = require('./jobs/expireHolds.job');
const { startPointsExpirationSweep } = require('./jobs/pointsExpiration.job');

const PORT = process.env.PORT || 8000;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

const httpServer = http.createServer(app);
initSocket(httpServer, allowedOrigins);

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`[server] listening on http://127.0.0.1:${PORT}/api`);
    });
    startSeatHoldSweep();
    startPointsExpirationSweep();
  })
  .catch((err) => {
    console.error('[server] failed to connect to MongoDB', err);
    process.exit(1);
  });
