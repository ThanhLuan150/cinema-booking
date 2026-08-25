const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

// Admins join `admin`, cinema owners join `owner:<accountId>`; everyone else stays
// unauthenticated and only receives public broadcasts (e.g. new movies).
function initSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.account = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        socket.authError = true;
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    if (socket.authError) {
      socket.emit('unauthorized', { reason: 'invalid_token' });
    }
    if (socket.account) {
      // Every authenticated socket (any role) joins its own account room, so account-targeted
      // events (e.g. Ticket 15's showtime:cancelled/rescheduled) can reach a specific customer.
      socket.join(`account:${socket.account.accountId}`);
      if (socket.account.role === 0) socket.join('admin');
      if (socket.account.role === 2) socket.join(`owner:${socket.account.accountId}`);
    }
  });

  return io;
}

function emitToAdmin(event, payload) {
  io?.to('admin').emit(event, payload);
}

function emitToOwner(ownerId, event, payload) {
  if (!ownerId) return;
  io?.to(`owner:${ownerId}`).emit(event, payload);
}

function emitToAccount(accountId, event, payload) {
  if (!accountId) return;
  io?.to(`account:${accountId}`).emit(event, payload);
}

function emitPublic(event, payload) {
  io?.emit(event, payload);
}

module.exports = { initSocket, emitToAdmin, emitToOwner, emitToAccount, emitPublic };
