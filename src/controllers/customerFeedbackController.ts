import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

function getUserId(req: AuthenticatedRequest): string | null {
  const userId = req.user?.userId;

  return typeof userId === "string" && userId.length > 0
    ? userId
    : null;
}

/**
 * Submit feedback/rating for a completed viewing.
 *
 * Rules:
 * - Customer must own the viewing.
 * - Viewing must be COMPLETED.
 * - Rating is optional, but when supplied it must be 1-5.
 * - Message is required.
 * - Customer cannot supply propertyId or marketerId.
 * - The backend derives property and source marketer from the viewing.
 * - Only one VIEWING feedback may exist for a viewing.
 */
export async function createCustomerViewingFeedback(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const viewingId =
      typeof req.params.viewingId === "string"
        ? req.params.viewingId
        : null;

    if (!viewingId) {
      return res.status(400).json({
        success: false,
        message: "Viewing ID is required",
      });
    }

    const { rating, message } = req.body ?? {};

    const viewing = await prisma.viewingRequest.findUnique({
      where: {
        id: viewingId,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            marketerId: true,
          },
        },
      },
    });

    if (!viewing) {
      return res.status(404).json({
        success: false,
        message: "Viewing not found",
      });
    }

    if (viewing.renterId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to review this viewing",
      });
    }

    if (viewing.status !== "COMPLETED") {
      return res.status(409).json({
        success: false,
        message: "Feedback can only be submitted after the viewing is completed",
      });
    }

    if (
      rating !== undefined &&
      rating !== null &&
      (
        typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer from 1 to 5",
      });
    }

    if (typeof message !== "string" || message.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Feedback message must be at least 3 characters",
      });
    }

    const existingFeedback = await prisma.feedback.findFirst({
      where: {
        userId,
        viewingId,
        category: "VIEWING",
      },
      select: {
        id: true,
      },
    });

    if (existingFeedback) {
      return res.status(409).json({
        success: false,
        message: "Feedback has already been submitted for this viewing",
      });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        category: "VIEWING",
        rating:
          typeof rating === "number"
            ? rating
            : null,
        message: message.trim(),
        propertyId: viewing.property.id,
        viewingId: viewing.id,
        marketerId: viewing.property.marketerId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Viewing feedback submitted successfully",
      data: {
        feedback: {
          id: feedback.id,
          category: feedback.category,
          rating: feedback.rating,
          message: feedback.message,
          propertyId: feedback.propertyId,
          viewingId: feedback.viewingId,
          marketerId: feedback.marketerId,
          createdAt: feedback.createdAt,
        },
      },
    });
  } catch (error) {
    console.error(
      "Create customer viewing feedback error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to submit feedback";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}
