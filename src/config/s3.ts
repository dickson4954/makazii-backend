import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;

if (!region) {
  console.warn(
    "AWS_REGION is not configured. S3 image uploads will not work until AWS is configured."
  );
}

export const s3Client = new S3Client({
  region: region || "us-east-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export const S3_BUCKET =
  process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || "";

export function assertS3Configured(): void {
  const missing: string[] = [];

  if (!process.env.AWS_REGION) {
    missing.push("AWS_REGION");
  }

  if (!S3_BUCKET) {
    missing.push("AWS_S3_BUCKET");
  }

  if (
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY
  ) {
    missing.push("AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `S3 storage is not configured. Missing: ${missing.join(", ")}`
    );
  }
}
