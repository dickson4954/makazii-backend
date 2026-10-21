import type { Response } from "express";
import { StayInspectionStatus } from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

async function findLandlordId(userId: string) {
  const landlord = await prisma.landlord.findUnique({
    where: { userId },
    select: { id: true },
  });

  return landlord?.id ?? null;
}

const landlordInspectionSelect = {
  id: true,
  requestedDate: true,
  preferredTime: true,
  notes: true,
  status: true,
  confirmedAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  property: {
    select: {
      id: true,
      title: true,
      purpose: true,
      shortStayType: true,
      dayRate: true,
      nightRate: true,
      dayNightRate: true,
      stayMode: true,
      bedrooms: true,
      bathrooms: true,
      beds: true,
      maxGuests: true,
      rooms: true,
      available: true,
      verified: true,
      status: true,
      county: true,
      town: true,
      area: true,
      viewingFee: true,
      images: {
        orderBy: [
          { isPrimary: "desc" as const },
          { sortOrder: "asc" as const },
        ],
        select: {
          id: true,
          url: true,
          isPrimary: true,
        },
        take: 1,
      },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
    },
  },
};

/**
 * GET /api/landlord/inspections
 * Lists short-stay inspections for the landlord's properties.
 */
export async function getLandlordStayInspections(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const landlordId = await findLandlordId(userId);

    if (!landlordId) {
      return res.status(404).json({
        success: false,
        message: "Landlord account was not found.",
      });
    }

    const requestedStatus =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : undefined;

    if (
      requestedStatus &&
      !Object.values(StayInspectionStatus).includes(
        requestedStatus as StayInspectionStatus,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid inspection status.",
      });
    }

    const inspections = await prisma.stayInspection.findMany({
      where: {
        property: { landlordId },
        ...(requestedStatus
          ? { status: requestedStatus as StayInspectionStatus }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: landlordInspectionSelect,
    });

    return res.status(200).json({
      success: true,
      data: {
        inspections,
        count: inspections.length,
      },
    });
  } catch (error) {
    console.error("Get landlord stay inspections error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load landlord inspections.",
    });
  }
}

/**
 * GET /api/landlord/inspections/:inspectionId
 * Returns an inspection only if its property belongs to this landlord.
 */
export async function getLandlordStayInspection(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const inspectionId = req.params.inspectionId;

    if (
      typeof inspectionId !== "string" ||
      !inspectionId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Inspection ID is required.",
      });
    }

    const landlordId = await findLandlordId(userId);

    if (!landlordId) {
      return res.status(404).json({
        success: false,
        message: "Landlord account was not found.",
      });
    }

    const inspection = await prisma.stayInspection.findFirst({
      where: {
        id: inspectionId.trim(),
        property: { landlordId },
      },
      select: landlordInspectionSelect,
    });

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: "Inspection request was not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    console.error("Get landlord stay inspection error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load the inspection request.",
    });
  }
}
