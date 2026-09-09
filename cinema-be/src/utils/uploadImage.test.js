const mockUploadStream = jest.fn();
const mockDestroy = jest.fn().mockResolvedValue({ result: 'ok' });

jest.mock('../config/cloudinary', () => ({
  uploader: { upload_stream: mockUploadStream, destroy: mockDestroy },
}));

const { uploadImage, uploadTrailer } = require('./uploadImage');

function fakeStream() {
  return { end: jest.fn() };
}

describe('uploadImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves with the secure_url on a successful upload', async () => {
    const stream = fakeStream();
    mockUploadStream.mockImplementation((options, callback) => {
      callback(null, { secure_url: 'https://cdn.example.com/a.jpg' });
      return stream;
    });

    const file = { buffer: Buffer.from('image-data') };
    const url = await uploadImage(file);

    expect(url).toBe('https://cdn.example.com/a.jpg');
    expect(mockUploadStream).toHaveBeenCalledWith(
      { folder: 'movies', resource_type: 'image' },
      expect.any(Function),
    );
    expect(stream.end).toHaveBeenCalledWith(file.buffer);
  });

  it('uses a custom folder when provided', async () => {
    const stream = fakeStream();
    mockUploadStream.mockImplementation((options, callback) => {
      callback(null, { secure_url: 'https://cdn.example.com/b.jpg' });
      return stream;
    });

    await uploadImage({ buffer: Buffer.from('x') }, 'avatars');

    expect(mockUploadStream).toHaveBeenCalledWith(
      { folder: 'avatars', resource_type: 'image' },
      expect.any(Function),
    );
  });

  it('rejects when cloudinary returns an error', async () => {
    const stream = fakeStream();
    const error = new Error('upload failed');
    mockUploadStream.mockImplementation((options, callback) => {
      callback(error, null);
      return stream;
    });

    await expect(uploadImage({ buffer: Buffer.from('x') })).rejects.toThrow('upload failed');
  });
});

describe('uploadImage metadata validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves when the reported dimensions are within the constraints', async () => {
    const stream = fakeStream();
    mockUploadStream.mockImplementation((options, callback) => {
      callback(null, { secure_url: 'https://cdn/ok.jpg', public_id: 'movies/ok', width: 1200, height: 1600 });
      return stream;
    });

    const url = await uploadImage({ buffer: Buffer.from('x') }, 'movies', { minWidth: 300, minHeight: 400 });

    expect(url).toBe('https://cdn/ok.jpg');
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it('rejects and destroys the asset when a dimension is out of bounds', async () => {
    const stream = fakeStream();
    mockUploadStream.mockImplementation((options, callback) => {
      callback(null, {
        secure_url: 'https://cdn/small.jpg',
        public_id: 'movies/small',
        resource_type: 'image',
        width: 100,
        height: 120,
      });
      return stream;
    });

    await expect(
      uploadImage({ buffer: Buffer.from('x') }, 'movies', { minWidth: 300, minHeight: 400 }),
    ).rejects.toThrow(/width 100px is below the 300px minimum/);
    expect(mockDestroy).toHaveBeenCalledWith('movies/small', { resource_type: 'image' });
  });

  it('rejects a video whose duration exceeds the limit', async () => {
    const stream = fakeStream();
    mockUploadStream.mockImplementation((options, callback) => {
      callback(null, { secure_url: 'https://cdn/long.mp4', public_id: 'movies/long', duration: 1200 });
      return stream;
    });

    await expect(
      uploadTrailer({ buffer: Buffer.from('x') }, 'movies', { maxDurationSeconds: 900 }),
    ).rejects.toThrow(/duration 1200s exceeds the 900s maximum/);
  });

  it('skips a check whose metric cloudinary did not report', async () => {
    const stream = fakeStream();
    mockUploadStream.mockImplementation((options, callback) => {
      callback(null, { secure_url: 'https://cdn/nodims.jpg', public_id: 'movies/nodims' });
      return stream;
    });

    const url = await uploadImage({ buffer: Buffer.from('x') }, 'movies', { minWidth: 300 });
    expect(url).toBe('https://cdn/nodims.jpg');
  });

  it('applies no metadata check when no constraints are passed', async () => {
    const stream = fakeStream();
    mockUploadStream.mockImplementation((options, callback) => {
      callback(null, { secure_url: 'https://cdn/any.jpg', public_id: 'movies/any', width: 1, height: 1 });
      return stream;
    });

    await expect(uploadImage({ buffer: Buffer.from('x') })).resolves.toBe('https://cdn/any.jpg');
  });
});

describe('uploadTrailer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves with the secure_url using resource_type auto', async () => {
    const stream = fakeStream();
    mockUploadStream.mockImplementation((options, callback) => {
      callback(null, { secure_url: 'https://cdn.example.com/t.mp4' });
      return stream;
    });

    const file = { buffer: Buffer.from('trailer-data') };
    const url = await uploadTrailer(file);

    expect(url).toBe('https://cdn.example.com/t.mp4');
    expect(mockUploadStream).toHaveBeenCalledWith(
      { folder: 'movies', resource_type: 'auto' },
      expect.any(Function),
    );
    expect(stream.end).toHaveBeenCalledWith(file.buffer);
  });

  it('uses a custom folder when provided', async () => {
    const stream = fakeStream();
    mockUploadStream.mockImplementation((options, callback) => {
      callback(null, { secure_url: 'https://cdn.example.com/t2.mp4' });
      return stream;
    });

    await uploadTrailer({ buffer: Buffer.from('x') }, 'trailers');

    expect(mockUploadStream).toHaveBeenCalledWith(
      { folder: 'trailers', resource_type: 'auto' },
      expect.any(Function),
    );
  });

  it('rejects when cloudinary returns an error', async () => {
    const stream = fakeStream();
    const error = new Error('upload failed');
    mockUploadStream.mockImplementation((options, callback) => {
      callback(error, null);
      return stream;
    });

    await expect(uploadTrailer({ buffer: Buffer.from('x') })).rejects.toThrow('upload failed');
  });
});
