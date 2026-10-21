import type { Request, Response } from "express";

import { uploadPropertyVideo } from "../services/propertyVideoUploadService";

export async function uploadPropertyVideoController(
  req: Request,
  res: Response
) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a video to upload using the 'video' field.",
      });
    }

    const uploaded = await uploadPropertyVideo(req.file);

    return res.status(201).json({
      success: true,
      message: "Property video uploaded successfully.",
      video: uploaded,
    });
  } catch (error) {
    console.error("PROPERTY VIDEO UPLOAD ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to upload the property video.";

    const status = /not configured/i.test(message) ? 503 : 400;

    return res.status(status).json({
      success: false,
      message,
    });
  }
}
