const cloudinary = require('../config/cloudinary');

async function uploadImage(file, folder = 'movies') {
  return uploadMedia(file, folder, 'image');
}

// Trailer uploads may be an image or a video; 'auto' lets Cloudinary detect which.
async function uploadTrailer(file, folder = 'movies') {
  return uploadMedia(file, folder, 'auto');
}

function uploadMedia(file, folder, resourceType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: resourceType }, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url);
    });
    stream.end(file.buffer);
  });
}

module.exports = { uploadImage, uploadTrailer };
