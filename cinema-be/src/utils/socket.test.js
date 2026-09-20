const mockEmit = jest.fn();
const mockTo = jest.fn(() => ({ emit: mockEmit }));
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockIoInstance = { use: mockUse, on: mockOn, to: mockTo, emit: mockEmit };
const MockServer = jest.fn().mockImplementation(() => mockIoInstance);

jest.mock('socket.io', () => ({ Server: MockServer }));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('./socketRooms', () => {
  const actual = jest.requireActual('./socketRooms');
  return { ...actual, resolveRoomsForAccount: jest.fn() };
});

const jwt = require('jsonwebtoken');
const { resolveRoomsForAccount } = require('./socketRooms');
const {
  initSocket,
  emitToAdmin,
  emitToStaff,
  emitToOwner,
  emitToAccount,
  emitToBranch,
  emitToSchedule,
  emitBranchEvent,
  emitPublic,
} = require('./socket');

// Lets a test await the room joins that the connection handler kicks off without awaiting.
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('initSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveRoomsForAccount.mockResolvedValue([]);
  });

  it('constructs a socket.io Server with cors options for the http server', () => {
    const httpServer = {};
    const io = initSocket(httpServer, ['http://localhost:5173']);
    expect(MockServer).toHaveBeenCalledWith(httpServer, {
      cors: { origin: ['http://localhost:5173'], credentials: true },
    });
    expect(io).toBe(mockIoInstance);
  });

  describe('io.use auth middleware', () => {
    function getUseCallback() {
      initSocket({}, []);
      return mockUse.mock.calls[0][0];
    }

    it('sets socket.account from a valid token and calls next', () => {
      const useCb = getUseCallback();
      const decoded = { accountId: 1, role: 1 };
      jwt.verify.mockReturnValue(decoded);
      const socket = { handshake: { auth: { token: 'valid-token' } } };
      const next = jest.fn();

      useCb(socket, next);

      expect(socket.account).toEqual(decoded);
      expect(next).toHaveBeenCalled();
    });

    it('falls through as anonymous but flags authError when the token is invalid', () => {
      const useCb = getUseCallback();
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });
      const socket = { handshake: { auth: { token: 'bad-token' } } };
      const next = jest.fn();

      expect(() => useCb(socket, next)).not.toThrow();
      expect(socket.account).toBeUndefined();
      expect(socket.authError).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    it('calls next without setting account when no token is present', () => {
      const useCb = getUseCallback();
      const socket = { handshake: {} };
      const next = jest.fn();

      useCb(socket, next);

      expect(socket.account).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('connection handler', () => {
    function getConnectionCallback() {
      initSocket({}, []);
      return mockOn.mock.calls.find((call) => call[0] === 'connection')[1];
    }

    function makeSocket(account) {
      return { account, join: jest.fn(), leave: jest.fn(), emit: jest.fn(), on: jest.fn() };
    }

    it('joins every room socketRooms resolves for the account', async () => {
      resolveRoomsForAccount.mockResolvedValue(['account:1', 'admin', 'staff']);
      const connectionCb = getConnectionCallback();
      const socket = makeSocket({ role: 0, accountId: 1 });

      connectionCb(socket);
      await flushPromises();

      expect(resolveRoomsForAccount).toHaveBeenCalledWith({ role: 0, accountId: 1 });
      expect(socket.join).toHaveBeenCalledWith('account:1');
      expect(socket.join).toHaveBeenCalledWith('admin');
      expect(socket.join).toHaveBeenCalledWith('staff');
    });

    it('joins the branch rooms an employee is staffed at — Ticket 23/21 operational feeds', async () => {
      resolveRoomsForAccount.mockResolvedValue(['account:9', 'staff', 'branch:3']);
      const connectionCb = getConnectionCallback();
      const socket = makeSocket({ role: 3, accountId: 9 });

      connectionCb(socket);
      await flushPromises();

      expect(socket.join).toHaveBeenCalledWith('branch:3');
    });

    it('does not resolve rooms for an anonymous socket', async () => {
      const connectionCb = getConnectionCallback();
      const socket = makeSocket(undefined);

      expect(() => connectionCb(socket)).not.toThrow();
      await flushPromises();

      expect(resolveRoomsForAccount).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('stays connected when resolving rooms fails', async () => {
      resolveRoomsForAccount.mockRejectedValue(new Error('db down'));
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const connectionCb = getConnectionCallback();
      const socket = makeSocket({ role: 2, accountId: 4 });

      expect(() => connectionCb(socket)).not.toThrow();
      await flushPromises();

      expect(socket.join).not.toHaveBeenCalled();
      console.error.mockRestore();
    });

    it('emits unauthorized when the socket was flagged with an authError', async () => {
      const connectionCb = getConnectionCallback();
      const socket = { authError: true, join: jest.fn(), leave: jest.fn(), emit: jest.fn(), on: jest.fn() };

      connectionCb(socket);
      await flushPromises();

      expect(socket.emit).toHaveBeenCalledWith('unauthorized', { reason: 'invalid_token' });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('does not emit unauthorized for a clean anonymous connection', async () => {
      const connectionCb = getConnectionCallback();
      const socket = makeSocket(undefined);

      connectionCb(socket);
      await flushPromises();

      expect(socket.emit).not.toHaveBeenCalled();
    });

    describe('schedule room opt-in', () => {
      function getHandlers(account) {
        const connectionCb = getConnectionCallback();
        const socket = makeSocket(account);
        connectionCb(socket);
        const handlerFor = (event) => socket.on.mock.calls.find((call) => call[0] === event)[1];
        return { socket, join: handlerFor('schedule:join'), leave: handlerFor('schedule:leave') };
      }

      it('lets even an anonymous socket subscribe to a showtime seat map', () => {
        const { socket, join } = getHandlers(undefined);
        join(42);
        expect(socket.join).toHaveBeenCalledWith('schedule:42');
      });

      it('leaves the schedule room on request', () => {
        const { socket, leave } = getHandlers({ role: 1, accountId: 5 });
        leave(42);
        expect(socket.leave).toHaveBeenCalledWith('schedule:42');
      });

      it('ignores a missing schedule id instead of joining a "schedule:undefined" room', () => {
        const { socket, join, leave } = getHandlers(undefined);
        join(undefined);
        join(null);
        join('');
        leave(undefined);
        expect(socket.join).not.toHaveBeenCalled();
        expect(socket.leave).not.toHaveBeenCalled();
      });
    });
  });
});

describe('emit helpers after initSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveRoomsForAccount.mockResolvedValue([]);
    initSocket({}, []);
  });

  it('emitToAdmin emits to the admin room', () => {
    emitToAdmin('new-movie', { id: 1 });
    expect(mockTo).toHaveBeenCalledWith('admin');
    expect(mockEmit).toHaveBeenCalledWith('new-movie', { id: 1 });
  });

  it('emitToStaff emits to the staff room', () => {
    emitToStaff('systemConfig:updated', { key: 'BOOKING_HOLD_TIME' });
    expect(mockTo).toHaveBeenCalledWith('staff');
    expect(mockEmit).toHaveBeenCalledWith('systemConfig:updated', { key: 'BOOKING_HOLD_TIME' });
  });

  it('emitToOwner emits to the owner room when ownerId is set', () => {
    emitToOwner(42, 'booking', { id: 1 });
    expect(mockTo).toHaveBeenCalledWith('owner:42');
    expect(mockEmit).toHaveBeenCalledWith('booking', { id: 1 });
  });

  it('emitToOwner no-ops when ownerId is falsy', () => {
    emitToOwner(null, 'booking', { id: 1 });
    expect(mockTo).not.toHaveBeenCalled();
  });

  it('emitToAccount emits to the account room when accountId is set', () => {
    emitToAccount(7, 'showtime:cancelled', { bookingId: 1 });
    expect(mockTo).toHaveBeenCalledWith('account:7');
    expect(mockEmit).toHaveBeenCalledWith('showtime:cancelled', { bookingId: 1 });
  });

  it('emitToAccount no-ops when accountId is falsy', () => {
    emitToAccount(null, 'showtime:cancelled', { bookingId: 1 });
    expect(mockTo).not.toHaveBeenCalled();
  });

  it('emitToBranch emits to the branch room', () => {
    emitToBranch(3, 'checkin:new', { invoiceId: 9 });
    expect(mockTo).toHaveBeenCalledWith('branch:3');
    expect(mockEmit).toHaveBeenCalledWith('checkin:new', { invoiceId: 9 });
  });

  it('emitToBranch no-ops when branchId is null or undefined', () => {
    emitToBranch(null, 'checkin:new', {});
    emitToBranch(undefined, 'checkin:new', {});
    expect(mockTo).not.toHaveBeenCalled();
  });

  // Branch 0 is not a real id here, but the guard must be a null check rather than a truthiness
  // check so a legitimately zero-valued id would still address its room.
  it('emitToBranch still emits for branch id 0', () => {
    emitToBranch(0, 'checkin:new', {});
    expect(mockTo).toHaveBeenCalledWith('branch:0');
  });

  it('emitToSchedule emits to the schedule room', () => {
    emitToSchedule(12, 'seat:updated', { seatCodes: ['A1'] });
    expect(mockTo).toHaveBeenCalledWith('schedule:12');
    expect(mockEmit).toHaveBeenCalledWith('seat:updated', { seatCodes: ['A1'] });
  });

  it('emitToSchedule no-ops when scheduleId is null', () => {
    emitToSchedule(null, 'seat:updated', {});
    expect(mockTo).not.toHaveBeenCalled();
  });

  it('emitBranchEvent reaches the branch and the admin room, stamping branchId into the payload', () => {
    emitBranchEvent(5, 'maintenance:updated', { id: 1 });
    expect(mockTo).toHaveBeenCalledWith('branch:5');
    expect(mockTo).toHaveBeenCalledWith('admin');
    expect(mockEmit).toHaveBeenCalledWith('maintenance:updated', { id: 1, branchId: 5 });
    expect(mockEmit).toHaveBeenCalledTimes(2);
  });

  it('emitBranchEvent still reaches admin for a branchless (system-wide) row', () => {
    emitBranchEvent(null, 'giftCard:updated', { id: 1 });
    expect(mockTo).toHaveBeenCalledWith('admin');
    expect(mockTo).not.toHaveBeenCalledWith('branch:null');
    expect(mockEmit).toHaveBeenCalledWith('giftCard:updated', { id: 1, branchId: null });
  });

  it('emitPublic emits directly on io', () => {
    emitPublic('announcement', { text: 'hi' });
    expect(mockEmit).toHaveBeenCalledWith('announcement', { text: 'hi' });
  });
});

describe('emit helpers before initSocket (io is null)', () => {
  it('all emit helpers no-op safely when io has not been initialized', () => {
    jest.resetModules();
    jest.doMock('socket.io', () => ({ Server: MockServer }));
    jest.doMock('jsonwebtoken', () => ({ verify: jest.fn() }));
    const fresh = require('./socket');

    expect(() => fresh.emitToAdmin('e', {})).not.toThrow();
    expect(() => fresh.emitToStaff('e', {})).not.toThrow();
    expect(() => fresh.emitToOwner(1, 'e', {})).not.toThrow();
    expect(() => fresh.emitToAccount(1, 'e', {})).not.toThrow();
    expect(() => fresh.emitToBranch(1, 'e', {})).not.toThrow();
    expect(() => fresh.emitToSchedule(1, 'e', {})).not.toThrow();
    expect(() => fresh.emitBranchEvent(1, 'e', {})).not.toThrow();
    expect(() => fresh.emitPublic('e', {})).not.toThrow();
  });
});
