const cloudinary = require('../config/cloudinary');

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// Validates the metadata Cloudinary reports for a freshly uploaded asset against `constraints`
// (see config/mediaConstraints.js). On violation the asset is destroyed so a rejected upload
// doesn't linger in storage, then a 400 error is thrown. A metric Cloudinary didn't report is
// skipped rather than treated as 0.
async function assertMetadata(result, constraints) {
  if (!constraints) return;

  const { width, height, duration, bytes } = result;
  const problems = [];

  if (constraints.minWidth && width && width < constraints.minWidth) {
    problems.push(`width ${width}px is below the ${constraints.minWidth}px minimum`);
  }
  if (constraints.minHeight && height && height < constraints.minHeight) {
    problems.push(`height ${height}px is below the ${constraints.minHeight}px minimum`);
  }
  if (constraints.maxWidth && width && width > constraints.maxWidth) {
    problems.push(`width ${width}px exceeds the ${constraints.maxWidth}px maximum`);
  }
  if (constraints.maxHeight && height && height > constraints.maxHeight) {
    problems.push(`height ${height}px exceeds the ${constraints.maxHeight}px maximum`);
  }
  if (constraints.maxDurationSeconds && duration && duration > constraints.maxDurationSeconds) {
    problems.push(`duration ${Math.round(duration)}s exceeds the ${constraints.maxDurationSeconds}s maximum`);
  }
  if (constraints.maxBytes && bytes && bytes > constraints.maxBytes) {
    const mb = (n) => (n / (1024 * 1024)).toFixed(1);
    problems.push(`file size ${mb(bytes)}MB exceeds the ${mb(constraints.maxBytes)}MB maximum`);
  }

  if (problems.length === 0) return;

  if (result.public_id) {
    try {
      await cloudinary.uploader.destroy(result.public_id, { resource_type: result.resource_type });
    } catch {
      // Best-effort cleanup; the validation failure below is what matters.
    }
  }
  throw validationError(`Uploaded media is invalid: ${problems.join('; ')}`);
}

async function uploadImage(file, folder = 'movies', constraints) {
  return uploadMedia(file, folder, 'image', constraints);
}

// Trailer uploads may be an image or a video; 'auto' lets Cloudinary detect which.
async function uploadTrailer(file, folder = 'movies', constraints) {
  return uploadMedia(file, folder, 'auto', constraints);
}

function uploadMedia(file, folder, resourceType, constraints) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: resourceType }, (error, result) => {
      if (error) return reject(error);
      assertMetadata(result, constraints)
        .then(() => resolve(result.secure_url))
        .catch(reject);
    });
    stream.end(file.buffer);
  });
}

module.exports = { uploadImage, uploadTrailer };
