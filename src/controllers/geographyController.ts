import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { uploadPropertyImage } from "../services/imageUploadService";

/**
 * GET ALL COUNTIES
 *
 * GET /api/admin/counties
 */
export async function getCounties(
  _req: AuthenticatedRequest,
  res: Response
) {
  try {
    const counties = await prisma.county.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            places: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        counties,
        count: counties.length,
      },
    });
  } catch (error) {
    console.error("Get counties error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve counties",
    });
  }
}

/**
 * CREATE COUNTY
 *
 * POST /api/admin/counties
 *
 * Body:
 * {
 *   name: string
 * }
 *
 * Manually created counties receive an internal Prisma ID.
 * Official Kenya geography records use sourceId separately.
 */
export async function createCounty(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { name, sourceId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "County name is required",
      });
    }

    if (!sourceId?.trim()) {
      return res.status(400).json({
        success: false,
        message: "County sourceId is required",
      });
    }

    const normalizedName = name.trim();
    const normalizedSourceId = sourceId.trim();



    const existingCounty = await prisma.county.findUnique({
      where: {
        name: normalizedName,
      },
    });

    if (existingCounty) {
      return res.status(409).json({
        success: false,
        message: "This county already exists",
      });
    }

    const county = await prisma.county.create({
      data: {
        id: crypto.randomUUID(),
        sourceId: normalizedSourceId,
        name: normalizedName,
      },
    });

    return res.status(201).json({
      success: true,
      message: "County created successfully",
      data: {
        county,
      },
    });
  } catch (error) {
    console.error("Create county error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create county",
    });
  }
}

/**
 * GET PLACES FOR COUNTY
 *
 * GET /api/admin/counties/:countyId/places
 */
export async function getPlacesByCounty(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const countyId = String(req.params.countyId);

    const county = await prisma.county.findUnique({
      where: {
        id: countyId,
      },
    });

    if (!county) {
      return res.status(404).json({
        success: false,
        message: "County not found",
      });
    }

    const places = await prisma.place.findMany({
      where: {
        countyId,
      },
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            marketers: true,
            properties: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        county,
        places,
        count: places.length,
      },
    });
  } catch (error) {
    console.error("Get places by county error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve places",
    });
  }
}

/**
 * CREATE PLACE
 *
 * POST /api/admin/counties/:countyId/places
 *
 * Body:
 * {
 *   name: string
 * }
 */
export async function createPlace(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const countyId = String(req.params.countyId);
    const { name, sourceId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "County name is required",
      });
    }

    if (!sourceId?.trim()) {
      return res.status(400).json({
        success: false,
        message: "County sourceId is required",
      });
    }

    const normalizedName = name.trim();
    const normalizedSourceId = sourceId.trim();



    const existingPlace = await prisma.place.findUnique({
      where: {
        countyId_name: {
          countyId,
          name: normalizedName,
        },
      },
    });

    if (existingPlace) {
      return res.status(409).json({
        success: false,
        message: "This place already exists in this county",
      });
    }

    const place = await prisma.place.create({
      data: {
        name: normalizedName,
        countyId,
      },
      include: {
        county: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Place created successfully",
      data: {
        place,
      },
    });
  } catch (error) {
    console.error("Create place error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create place",
    });
  }
}


/**
 * Upload or replace a county cover image.
 * PATCH /api/admin/counties/:countyId/cover
 */
export async function uploadCountyCover(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const countyId = String(req.params.countyId ?? "").trim();
    const file = req.file;

    if (!countyId) {
      return res.status(400).json({
        success: false,
        message: "County ID is required",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image to upload.",
      });
    }

    const county = await prisma.county.findUnique({
      where: { id: countyId },
      select: { id: true, name: true },
    });

    if (!county) {
      return res.status(404).json({
        success: false,
        message: "County not found",
      });
    }

    const uploaded = await uploadPropertyImage(file);

    const updatedCounty = await prisma.county.update({
      where: { id: countyId },
      data: { coverImageUrl: uploaded.url },
      select: {
        id: true,
        name: true,
        coverImageUrl: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "County cover image updated successfully.",
      data: { county: updatedCounty },
    });
  } catch (error) {
    console.error("Upload county cover error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update county cover image.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}
