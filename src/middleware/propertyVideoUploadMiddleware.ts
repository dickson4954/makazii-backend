import multer from "multer";

const MAX_PROPERTY_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

/**
 * House videos are held in memory only while they are uploaded
 * to S3. This middleware does not write public files to disk.
 */
export const propertyVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROPERTY_VIDEO_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_VIDEO_TYPES.has(file.mimetype.toLowerCase())) {
      return callback(
        new Error(
          "Unsupported video type. Upload an MP4, MOV, or WebM video."
        )
      );
    }

    callback(null, true);
  },
});
