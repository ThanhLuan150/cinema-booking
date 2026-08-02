const mockUploadStream = jest.fn();

jest.mock('../config/cloudinary', () => ({
  uploader: { upload_stream: mockUploadStream },
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
