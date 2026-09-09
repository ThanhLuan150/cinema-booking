// Metadata bounds for movie content media (Ticket 34: "Validate image/video metadata nếu có").
// These are checked against the width/height/duration/bytes Cloudinary reports for a freshly
// uploaded asset; anything outside the bounds is deleted again and the request fails with 400.
// Missing metadata (e.g. Cloudinary didn't report a dimension) is treated as "no opinion" so a
// check never blocks an upload it can't actually evaluate.
module.exports = {
  // Portrait key art.
  POSTER: { minWidth: 300, minHeight: 400, maxWidth: 4000, maxHeight: 6000 },
  // Wide hero strip behind the poster on the detail page.
  BANNER: { minWidth: 900, minHeight: 300, maxWidth: 6000, maxHeight: 3000 },
  // Stills shown in the gallery grid.
  GALLERY: { minWidth: 480, minHeight: 270, maxWidth: 6000, maxHeight: 4000 },
  // Trailer may be a poster-style image or a video clip; only the video path has a duration.
  TRAILER: { maxDurationSeconds: 900, maxBytes: 50 * 1024 * 1024 },
};
