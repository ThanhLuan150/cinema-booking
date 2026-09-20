const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { ROOM, resolveRoomsForAccount } = require('./socketRooms');
const { CLIENT_EVENT, REALTIME_EVENT } = require('./realtimeEvents');

let io = null;

// Room model (see utils/socketRooms.js for who joins what):
//   account:<id>   every authenticated socket — personal events (notifications, my booking, my refund)
//   admin          SUPER_ADMIN — the company-wide firehose
//   owner:<id>     BRANCH_ADMIN — the branch admin alone, without their employees. Reserved for
//                  the payloads employees should not see, e.g. `booking:new` and its takings
//                  figure; anything the whole branch may read belongs on `branch:<id>`.
//   staff          any non-customer — cross-branch staff broadcasts (system config, catalogue)
//   branch:<id>    the branch's owner + its active employees — branch-scoped operations
//   schedule:<id>  anyone currently looking at that showtime's seat map (opt-in, see below)
//
// The rooms overlap, and socket.io delivers once per `to(room).emit(...)` call — so a socket in
// two of the targeted rooms receives the same event twice. A Branch Admin, for instance, is in
// `owner:<id>`, `branch:<id>` AND the audience of emitPublic, which would mean three toasts for
// one branch status change. The rule every caller follows: **one event name, one channel**. When
// two audiences need different payloads, they get two different event names instead (e.g. the
// owner-only `branch:activated` toast vs. the public `branch:updated` cache invalidation).
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
      socket.emit(REALTIME_EVENT.UNAUTHORIZED, { reason: 'invalid_token' });
    }

    // The seat map is the one room a client opts into, because it is per-showtime: a socket joins
    // while the seat grid is on screen and leaves when it navigates away. Seat events carry no
    // identity (only seat codes + their new status), so this is safe for anonymous sockets too.
    socket.on(CLIENT_EVENT.SCHEDULE_JOIN, (scheduleId) => {
      if (scheduleId === undefined || scheduleId === null || scheduleId === '') return;
      socket.join(ROOM.schedule(scheduleId));
    });
    socket.on(CLIENT_EVENT.SCHEDULE_LEAVE, (scheduleId) => {
      if (scheduleId === undefined || scheduleId === null || scheduleId === '') return;
      socket.leave(ROOM.schedule(scheduleId));
    });

    if (!socket.account) return;

    // Branch membership needs a DB round trip, so joining is async. A socket that disconnects
    // before it resolves simply never joins; a failure must not take the connection down.
    resolveRoomsForAccount(socket.account)
      .then((rooms) => rooms.forEach((room) => socket.join(room)))
      .catch((err) => console.error('[socket] failed to resolve rooms', err.message));
  });

  return io;
}

function emitToRoom(room, event, payload) {
  io?.to(room).emit(event, payload);
}

function emitToAdmin(event, payload) {
  emitToRoom(ROOM.admin(), event, payload);
}

function emitToStaff(event, payload) {
  emitToRoom(ROOM.staff(), event, payload);
}

function emitToOwner(ownerId, event, payload) {
  if (!ownerId) return;
  emitToRoom(ROOM.owner(ownerId), event, payload);
}

function emitToAccount(accountId, event, payload) {
  if (!accountId) return;
  emitToRoom(ROOM.account(accountId), event, payload);
}

function emitToBranch(branchId, event, payload) {
  if (branchId === null || branchId === undefined) return;
  emitToRoom(ROOM.branch(branchId), event, payload);
}

function emitToSchedule(scheduleId, event, payload) {
  if (scheduleId === null || scheduleId === undefined) return;
  emitToRoom(ROOM.schedule(scheduleId), event, payload);
}

function emitPublic(event, payload) {
  io?.emit(event, payload);
}

// The house style for a branch-scoped operational event: the branch's own staff see it, and
// SUPER_ADMIN sees every branch's copy without having to join every branch room. `branchId` is
// stamped into the payload so an admin client can tell the branches apart.
function emitBranchEvent(branchId, event, payload = {}) {
  const enriched = { ...payload, branchId: branchId ?? payload.branchId ?? null };
  emitToBranch(branchId, event, enriched);
  emitToAdmin(event, enriched);
}

module.exports = {
  initSocket,
  emitToAdmin,
  emitToStaff,
  emitToOwner,
  emitToAccount,
  emitToBranch,
  emitToSchedule,
  emitBranchEvent,
  emitPublic,
};
