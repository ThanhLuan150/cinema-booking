jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
  },
}));
// Prevent dotenv from reloading real values from the repo's .env file, which would
// clobber the env vars this test deliberately deletes/sets.
jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('config/cloudinary', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('configures cloudinary from environment variables at load time', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'my-cloud';
    process.env.CLOUDINARY_API_KEY = 'my-key';
    process.env.CLOUDINARY_API_SECRET = 'my-secret';
    process.env.CLOUDINARY_API_ENVIRONMENT_VARIABLE = 'my-env-var';

    jest.resetModules();
    const cloudinary = require('cloudinary').v2;
    const configured = require('./cloudinary');

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'my-cloud',
      api_key: 'my-key',
      api_secret: 'my-secret',
      api_environment_variable: 'my-env-var',
    });
    expect(configured).toBe(cloudinary);
  });

  it('passes through undefined values when env vars are unset', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_API_ENVIRONMENT_VARIABLE;

    jest.resetModules();
    const cloudinary = require('cloudinary').v2;
    require('./cloudinary');

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: undefined,
      api_key: undefined,
      api_secret: undefined,
      api_environment_variable: undefined,
    });
  });
});
