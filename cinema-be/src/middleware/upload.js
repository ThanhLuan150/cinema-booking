const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    if (file.fieldname === 'avatar' && !isImage) {
      return cb(new Error('Avatar must be an image file'));
    }
    if (file.fieldname === 'images' && !isImage) {
      return cb(new Error('Images must be image files'));
    }
    if (file.fieldname === 'trailer' && !isImage && !isVideo) {
      return cb(new Error('Trailer must be an image or video file'));
    }
    cb(null, true);
  },
});

module.exports = upload;
