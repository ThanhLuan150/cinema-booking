const upload = require('./upload');

function getFileFilter() {
  return upload.fileFilter;
}

describe('upload middleware fileFilter', () => {
  const fileFilter = getFileFilter();

  function run(fieldname, mimetype) {
    return new Promise((resolve) => {
      fileFilter({}, { fieldname, mimetype }, (err, accept) => resolve({ err, accept }));
    });
  }

  it('accepts an image for the avatar field', async () => {
    const { err, accept } = await run('avatar', 'image/png');
    expect(err).toBeNull();
    expect(accept).toBe(true);
  });

  it('rejects a non-image for the avatar field', async () => {
    const { err } = await run('avatar', 'video/mp4');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Avatar must be an image/);
  });

  it('accepts an image or video for the trailer field', async () => {
    expect((await run('trailer', 'image/jpeg')).accept).toBe(true);
    expect((await run('trailer', 'video/mp4')).accept).toBe(true);
  });

  it('rejects a non-image/video for the trailer field', async () => {
    const { err } = await run('trailer', 'application/pdf');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Trailer must be an image or video/);
  });

  it('accepts an image for the images field', async () => {
    const { err, accept } = await run('images', 'image/jpeg');
    expect(err).toBeNull();
    expect(accept).toBe(true);
  });

  it('rejects a non-image for the images field', async () => {
    const { err } = await run('images', 'video/mp4');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Images must be image files/);
  });

  it('accepts any file for an unrecognized field', async () => {
    const { err, accept } = await run('other', 'application/pdf');
    expect(err).toBeNull();
    expect(accept).toBe(true);
  });
});
