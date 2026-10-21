import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import multer from "multer";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * -------------------------------------------------------------
 * PROPERTY IMAGES
 * -------------------------------------------------------------
 *
 * Property images remain in memory because they are uploaded
 * to the configured property-image storage service.
 */
export const propertyImageUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return callback(
        new Error(
          "Unsupported image type. Only JPEG, PNG, and WebP images are allowed."
        )
      );
    }

    callback(null, true);
  },
});

/**
 * -------------------------------------------------------------
 * MARKETER ID DOCUMENTS
 * -------------------------------------------------------------
 *
 * These documents are temporarily written to disk because
 * the identity-verification service requires filesystem paths.
 *
 * They are NOT public files.
 *
 * After the application is created, the controller moves them
 * into:
 *
 * storage/private/marketer-ids/<application-id>/
 *
 * That directory must never be exposed through express.static().
 */

const marketerIdTempDirectory = path.resolve(
  process.cwd(),
  "storage",
  "tmp",
  "marketer-ids"
);

fs.mkdirSync(marketerIdTempDirectory, {
  recursive: true,
});

const marketerIdStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, marketerIdTempDirectory);
  },

  filename: (_req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const safeExtension = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
    ].includes(extension)
      ? extension
      : ".jpg";

    const uniqueName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 12)}${safeExtension}`;

    callback(null, uniqueName);
  },
});

export const marketerIdUpload = multer({
  storage: marketerIdStorage,

  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 2,
  },

  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return callback(
        new Error(
          "Unsupported identity document image type. Only JPEG, PNG, and WebP images are allowed."
        )
      );
    }

    callback(null, true);
  },
});


/**
 * -------------------------------------------------------------
 * LANDLORD ID DOCUMENTS
 * -------------------------------------------------------------
 *
 * Uploaded files are temporary until the landlord application
 * is created. The controller must move them into private
 * storage/private/landlord-ids/<landlord-id>/.
 *
 * Never expose these documents through express.static().
 */

const landlordIdTempDirectory = path.resolve(
  process.cwd(),
  "storage",
  "tmp",
  "landlord-ids"
);

fs.mkdirSync(landlordIdTempDirectory, {
  recursive: true,
});

const landlordIdStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, landlordIdTempDirectory);
  },

  filename: (_req, file, callback) => {
    const extensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };

    const extension =
      extensions[file.mimetype] || ".jpg";

    const uniqueName =
      `${Date.now()}-${cryptoRandomName()}${extension}`;

    callback(null, uniqueName);
  },
});

function cryptoRandomName(): string {
  return randomBytes(12).toString("hex");
}

export const landlordIdUpload = multer({
  storage: landlordIdStorage,

  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 2,
  },

  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return callback(
        new Error(
          "Unsupported landlord identity document type. Only JPEG, PNG, and WebP images are allowed."
        )
      );
    }

    callback(null, true);
  },
});
