const mockEmit = jest.fn();
const mockTo = jest.fn(() => ({ emit: mockEmit }));
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockIoInstance = { use: mockUse, on: mockOn, to: mockTo, emit: mockEmit };
const MockServer = jest.fn().mockImplementation(() => mockIoInstance);

jest.mock('socket.io', () => ({ Server: MockServer }));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const jwt = require('jsonwebtoken');
const { initSocket, emitToAdmin, emitToOwner, emitPublic } = require('./socket');

describe('initSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    it('joins the admin room for role 0', () => {
      const connectionCb = getConnectionCallback();
      const socket = { account: { role: 0, accountId: 1 }, join: jest.fn() };

      connectionCb(socket);

      expect(socket.join).toHaveBeenCalledWith('admin');
      expect(socket.join).toHaveBeenCalledTimes(1);
    });

    it('joins the owner room for role 2', () => {
      const connectionCb = getConnectionCallback();
      const socket = { account: { role: 2, accountId: 42 }, join: jest.fn() };

      connectionCb(socket);

      expect(socket.join).toHaveBeenCalledWith('owner:42');
      expect(socket.join).toHaveBeenCalledTimes(1);
    });

    it('does not join any room for a regular user (role 1)', () => {
      const connectionCb = getConnectionCallback();
      const socket = { account: { role: 1, accountId: 1 }, join: jest.fn() };

      connectionCb(socket);

      expect(socket.join).not.toHaveBeenCalled();
    });

    it('does nothing when the socket has no account (anonymous)', () => {
      const connectionCb = getConnectionCallback();
      const socket = { join: jest.fn() };

      expect(() => connectionCb(socket)).not.toThrow();
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('emits unauthorized when the socket was flagged with an authError', () => {
      const connectionCb = getConnectionCallback();
      const socket = { authError: true, join: jest.fn(), emit: jest.fn() };

      connectionCb(socket);

      expect(socket.emit).toHaveBeenCalledWith('unauthorized', { reason: 'invalid_token' });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('does not emit unauthorized for a clean anonymous connection', () => {
      const connectionCb = getConnectionCallback();
      const socket = { join: jest.fn(), emit: jest.fn() };

      connectionCb(socket);

      expect(socket.emit).not.toHaveBeenCalled();
    });
  });
});

describe('emit helpers after initSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initSocket({}, []);
  });

  it('emitToAdmin emits to the admin room', () => {
    emitToAdmin('new-movie', { id: 1 });
    expect(mockTo).toHaveBeenCalledWith('admin');
    expect(mockEmit).toHaveBeenCalledWith('new-movie', { id: 1 });
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
    expect(() => fresh.emitToOwner(1, 'e', {})).not.toThrow();
    expect(() => fresh.emitPublic('e', {})).not.toThrow();
  });
});
