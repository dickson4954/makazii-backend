import { Request, Response } from "express";

import { uploadPropertyImage } from "../services/imageUploadService";

export async function uploadPropertyImageController(
  req: Request,
  res: Response
) {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image to upload.",
      });
    }

    const uploaded = await uploadPropertyImage(file);

    return res.status(201).json({
      success: true,
      message: "Property image uploaded successfully.",
      image: uploaded,
    });
  } catch (error) {
    console.error("PROPERTY IMAGE UPLOAD ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to upload property image.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}
