import type { Response } from "express";
import { ViewingStatus } from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

async function getLandlordId(userId: string) {
  const landlord = await prisma.landlord.findUnique({
    where: { userId },
    select: { id: true },
  });

  return landlord?.id ?? null;
}

/**
 * GET /api/landlord/viewings
 * List viewings for properties owned by the authenticated landlord.
 */
export async function getLandlordViewings(
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

    const landlordId = await getLandlordId(userId);

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
      !Object.values(ViewingStatus).includes(
        requestedStatus as ViewingStatus,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid viewing status.",
      });
    }

    const viewings = await prisma.viewingRequest.findMany({
      where: {
        property: { landlordId },
        ...(requestedStatus
          ? { status: requestedStatus as ViewingStatus }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        requestedDate: true,
        preferredTime: true,
        scheduledAt: true,
        notes: true,
        status: true,
        requestedBy: true,
        createdAt: true,
        updatedAt: true,
        payments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            purpose: true,
            longStayType: true,
            monthlyRent: true,
            viewingFee: true,
            county: true,
            town: true,
            area: true,
            status: true,
            images: {
              orderBy: [
                { isPrimary: "desc" },
                { sortOrder: "asc" },
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
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        viewings,
        count: viewings.length,
      },
    });
  } catch (error) {
    console.error("Get landlord viewings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load landlord viewings.",
    });
  }
}

/**
 * GET /api/landlord/viewings/:viewingId
 * Retrieve one viewing, verifying ownership through its property.
 */
export async function getLandlordViewing(
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

    const viewingId = req.params.viewingId;

    if (
      typeof viewingId !== "string" ||
      !viewingId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Viewing ID is required.",
      });
    }

    const landlordId = await getLandlordId(userId);

    if (!landlordId) {
      return res.status(404).json({
        success: false,
        message: "Landlord account was not found.",
      });
    }

    const viewing = await prisma.viewingRequest.findFirst({
      where: {
        id: viewingId.trim(),
        property: { landlordId },
      },
      select: {
        id: true,
        requestedDate: true,
        preferredTime: true,
        scheduledAt: true,
        notes: true,
        status: true,
        requestedBy: true,
        createdAt: true,
        updatedAt: true,
        payments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            purpose: true,
            longStayType: true,
            monthlyRent: true,
            viewingFee: true,
            county: true,
            town: true,
            area: true,
            status: true,
            images: {
              orderBy: [
                { isPrimary: "desc" },
                { sortOrder: "asc" },
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
      },
    });

    if (!viewing) {
      return res.status(404).json({
        success: false,
        message: "Viewing request was not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: viewing,
    });
  } catch (error) {
    console.error("Get landlord viewing error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load the viewing request.",
    });
  }
}
