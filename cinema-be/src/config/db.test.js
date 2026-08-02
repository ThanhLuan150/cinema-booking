jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  connection: {
    on: jest.fn(),
  },
}));

const mongoose = require('mongoose');
const connectDB = require('./db');

describe('connectDB', () => {
  const originalUri = process.env.MONGODB_URI;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  });

  it('connects with the default URI when MONGODB_URI is not set', async () => {
    delete process.env.MONGODB_URI;
    await connectDB();
    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://127.0.0.1:27017/cinema_booking');
  });

  it('connects with MONGODB_URI when set', async () => {
    process.env.MONGODB_URI = 'mongodb://custom-host:27017/custom_db';
    await connectDB();
    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://custom-host:27017/custom_db');
  });

  it('wires up connected/error event listeners', async () => {
    await connectDB();
    expect(mongoose.connection.on).toHaveBeenCalledWith('connected', expect.any(Function));
    expect(mongoose.connection.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('does not throw when the listener callbacks are invoked', async () => {
    await connectDB();
    const connectedHandler = mongoose.connection.on.mock.calls.find((c) => c[0] === 'connected')[1];
    const errorHandler = mongoose.connection.on.mock.calls.find((c) => c[0] === 'error')[1];
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => connectedHandler()).not.toThrow();
    expect(() => errorHandler(new Error('boom'))).not.toThrow();

    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('does not throw when mongoose.connect resolves', async () => {
    await expect(connectDB()).resolves.toBeUndefined();
  });
});
