import crypto from "crypto";
import path from "path";

import {
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  assertS3Configured,
  s3Client,
  S3_BUCKET,
} from "../config/s3";

export interface UploadedImage {
  url: string;
  publicId: string;
  originalName: string;
  mimeType: string;
  size: number;
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

function getExtension(mimeType: string, originalName: string): string {
  const extensionFromName = path
    .extname(originalName)
    .toLowerCase()
    .replace(".", "");

  if (extensionFromName) {
    return extensionFromName;
  }

  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function getS3ObjectUrl(key: string): string {
  const region = process.env.AWS_REGION;

  if (!region) {
    throw new Error("AWS_REGION is not configured");
  }

  return `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}

export async function uploadPropertyImage(
  file: Express.Multer.File
): Promise<UploadedImage> {
  assertS3Configured();

  if (!file) {
    throw new Error("No image file was provided");
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    throw new Error(
      "Unsupported image type. Only JPEG, PNG, and WebP images are allowed."
    );
  }

  if (file.size <= 0) {
    throw new Error("The uploaded image is empty");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Image is too large. Maximum size is 10 MB.");
  }

  const extension = getExtension(file.mimetype, file.originalname);

  const randomId = crypto.randomBytes(16).toString("hex");

  const key = `properties/${new Date().getFullYear()}/${randomId}.${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000",
    })
  );

  return {
    url: getS3ObjectUrl(key),
    publicId: key,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}
