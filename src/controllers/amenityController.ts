import { Request, Response } from "express";
import prisma from "../config/prisma";

export async function getAmenities(
  _req: Request,
  res: Response
) {
  try {
    const amenities = await prisma.amenity.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });

    return res.status(200).json({
      success: true,
      amenities,
    });
  } catch (error) {
    console.error("GET AMENITIES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load amenities.",
    });
  }
}
