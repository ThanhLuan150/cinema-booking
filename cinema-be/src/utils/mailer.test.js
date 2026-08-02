describe('mailer (no SMTP configured, console fallback)', () => {
  const ORIGINAL_ENV = process.env;
  let logSpy;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SMTP_HOST;
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.env = ORIGINAL_ENV;
  });

  it('sendOtpEmail logs the otp and resolves with a console-log messageId', async () => {
    const { sendOtpEmail } = require('./mailer');
    const result = await sendOtpEmail('user@example.com', '123456');
    expect(result).toEqual({ messageId: 'console-log' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('123456'));
  });

  it('sendPasswordResetEmail logs the reset code', async () => {
    const { sendPasswordResetEmail } = require('./mailer');
    const result = await sendPasswordResetEmail('user@example.com', '654321');
    expect(result).toEqual({ messageId: 'console-log' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('654321'));
  });

  it('sendInvoiceEmail logs seats and price for the booking', async () => {
    const { sendInvoiceEmail } = require('./mailer');
    const result = await sendInvoiceEmail('user@example.com', {
      seats: ['A1', 'A2'],
      schedule_id: 42,
      price: 200000,
    });
    expect(result).toEqual({ messageId: 'console-log' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('A1, A2'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('42'));
  });
});
