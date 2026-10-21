import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

type CustomerConcernCategory =
  | "Property information"
  | "Pricing"
  | "Property availability"
  | "Property condition"
  | "Viewing experience"
  | "Safety concern"
  | "Suspicious listing"
  | "Marketer/representative"
  | "Other";

function getUserId(req: AuthenticatedRequest): string | null {
  const userId = req.user?.userId;

  return typeof userId === "string" && userId.length > 0
    ? userId
    : null;
}

function mapConcernCategory(
  category: CustomerConcernCategory,
) {
  switch (category) {
    case "Viewing experience":
      return "VIEWING";

    case "Marketer/representative":
      return "MARKETER";

    case "Property information":
    case "Pricing":
    case "Property availability":
    case "Property condition":
    case "Suspicious listing":
      return "PROPERTY";

    case "Safety concern":
    case "Other":
    default:
      return "OTHER";
  }
}

export async function createCustomerViewingProblemReport(
  req: AuthenticatedRequest,
  res: Response,
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

    const { category, message } = req.body ?? {};

    const validCategories: CustomerConcernCategory[] = [
      "Property information",
      "Pricing",
      "Property availability",
      "Property condition",
      "Viewing experience",
      "Safety concern",
      "Suspicious listing",
      "Marketer/representative",
      "Other",
    ];

    if (
      typeof category !== "string" ||
      !validCategories.includes(
        category as CustomerConcernCategory,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid concern category",
      });
    }

    if (
      typeof message !== "string" ||
      message.trim().length < 10
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Concern description must be at least 10 characters",
      });
    }

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
        message:
          "You are not allowed to report a concern for this viewing",
      });
    }

    if (viewing.status !== "COMPLETED") {
      return res.status(409).json({
        success: false,
        message:
          "Concerns can only be submitted after the viewing is completed",
      });
    }

    const report = await prisma.problemReport.create({
      data: {
        userId,
        category: mapConcernCategory(
          category as CustomerConcernCategory,
        ),
        customerCategory:
          category as CustomerConcernCategory,
        message: message.trim(),
        propertyId: viewing.property.id,
        viewingId: viewing.id,
        marketerId: viewing.property.marketerId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Concern submitted successfully",
      data: {
        report: {
          id: report.id,
          category: report.category,
          customerCategory: report.customerCategory,
          message: report.message,
          propertyId: report.propertyId,
          viewingId: report.viewingId,
          marketerId: report.marketerId,
          status: report.status,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error(
      "Create customer viewing problem report error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to submit concern";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}
