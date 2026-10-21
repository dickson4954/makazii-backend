import crypto from "node:crypto";

import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import {
  assertS3Configured,
  s3Client,
  S3_BUCKET,
} from "../config/s3";

export interface UploadedPropertyVideo {
  url: string;
  publicId: string;
  originalName: string;
  mimeType: string;
  size: number;
}

const MAX_PROPERTY_VIDEO_SIZE = 100 * 1024 * 1024;

const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function getS3ObjectUrl(key: string): string {
  const region = process.env.AWS_REGION;

  if (!region) {
    throw new Error("AWS_REGION is not configured.");
  }

  return `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Check common container signatures rather than trusting only
 * the MIME type supplied by the uploading client.
 *
 * This is a basic format check, not a full video decoder or
 * malware scan.
 */
function hasExpectedVideoSignature(
  buffer: Buffer,
  mimeType: string
): boolean {
  if (mimeType === "video/webm") {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    );
  }

  if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 4, 8) === "ftyp"
    );
  }

  return false;
}

export async function uploadPropertyVideo(
  file: Express.Multer.File
): Promise<UploadedPropertyVideo> {
  assertS3Configured();

  if (!file || !file.buffer) {
    throw new Error("Please select a video to upload.");
  }

  const mimeType = file.mimetype.toLowerCase();
  const extension = VIDEO_EXTENSIONS[mimeType];

  if (!extension) {
    throw new Error("Upload an MP4, MOV, or WebM video.");
  }

  if (file.size <= 0 || file.buffer.length === 0) {
    throw new Error("The uploaded video is empty.");
  }

  if (file.size > MAX_PROPERTY_VIDEO_SIZE) {
    throw new Error("The video exceeds the 100 MB limit.");
  }

  if (file.size !== file.buffer.length) {
    throw new Error("The uploaded video size could not be verified.");
  }

  if (!hasExpectedVideoSignature(file.buffer, mimeType)) {
    throw new Error(
      "The file does not have the expected MP4, MOV, or WebM container signature."
    );
  }

  const key =
    `property-videos/${new Date().getUTCFullYear()}/` +
    `${crypto.randomBytes(20).toString("hex")}.${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000",
    })
  );

  return {
    url: getS3ObjectUrl(key),
    publicId: key,
    originalName: file.originalname,
    mimeType,
    size: file.size,
  };
}


/**
 * Accept only a video that exists in the configured S3 bucket and
 * matches the URL/key returned by our own upload endpoint.
 */
export async function requireUploadedPropertyVideo(
  videoUrl: unknown,
  videoPublicId: unknown,
  videoMimeType: unknown
): Promise<{ videoUrl: string; videoPublicId: string; videoMimeType: string }> {
  if (
    typeof videoUrl !== "string" ||
    typeof videoPublicId !== "string" ||
    typeof videoMimeType !== "string"
  ) {
    throw new Error("Upload a property video before submitting the property.");
  }

  const url = videoUrl.trim();
  const key = videoPublicId.trim();
  const mimeType = videoMimeType.trim().toLowerCase();
  const extensions: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  const extension = extensions[mimeType];

  if (!extension) {
    throw new Error("The property video must be MP4, MOV, or WebM.");
  }

  if (
    !/^property-videos\/\d{4}\/[a-f0-9]{40}\.(mp4|mov|webm)$/.test(key) ||
    !key.endsWith(`.${extension}`)
  ) {
    throw new Error("Upload the video through MAKAZII before submitting the property.");
  }

  if (url !== getS3ObjectUrl(key)) {
    throw new Error("The video URL does not match the uploaded S3 object.");
  }

  assertS3Configured();

  const object = await s3Client.send(
    new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );

  if (!object.ContentLength || object.ContentLength <= 0) {
    throw new Error("The uploaded property video is empty or unavailable.");
  }

  if (
    object.ContentType &&
    object.ContentType.toLowerCase() !== mimeType
  ) {
    throw new Error("The uploaded video's content type does not match.");
  }

  return {
    videoUrl: url,
    videoPublicId: key,
    videoMimeType: mimeType,
  };
}
