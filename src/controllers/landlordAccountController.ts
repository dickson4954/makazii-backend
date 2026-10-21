import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

export async function getLandlordAccount(
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

const landlord = await prisma.landlord.findUnique({
  where: { userId },
  select: {
    applicationStatus: true,
    reviewNotes: true,
    reviewedAt: true,
    idVerificationStatus: true,
    idVerificationMessage: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        accountStatus: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    },
  },
});

if (!landlord) {
  return res.status(404).json({
    success: false,
    message: "Landlord account was not found.",
  });
}

return res.status(200).json({
  success: true,
  data: {
    profile: landlord.user,
    application: {
      status: landlord.applicationStatus,
      reviewNotes: landlord.reviewNotes,
      reviewedAt: landlord.reviewedAt,
      submittedAt: landlord.createdAt,
      updatedAt: landlord.updatedAt,
    },
    identity: {
      verificationStatus: landlord.idVerificationStatus,
      verificationMessage: landlord.idVerificationMessage,
    },
  },
});

} catch (error) {
console.error("Get landlord account error:", error);

return res.status(500).json({
  success: false,
  message: "Failed to load landlord account.",
});

}
}


export async function updateLandlordQuestionnaire(
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

    const submittedIds = req.body?.propertyCountyIds;

    if (
      !Array.isArray(submittedIds) ||
      submittedIds.length === 0 ||
      submittedIds.some(
        (id: unknown) => typeof id !== "string" || !id.trim(),
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Select at least one valid property county.",
      });
    }

    const countyIds = [...new Set(
      submittedIds.map((id: string) => id.trim()),
    )];

    if (countyIds.length !== submittedIds.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate county selections are not allowed.",
      });
    }

    const landlord = await prisma.landlord.findUnique({
      where: { userId },
      select: {
        id: true,
        applicationStatus: true,
        questionnaire: true,
      },
    });

    if (!landlord) {
      return res.status(404).json({
        success: false,
        message: "Landlord application was not found.",
      });
    }

    if (
      landlord.applicationStatus === "APPROVED" ||
      landlord.applicationStatus === "REJECTED"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This application can no longer be edited through this endpoint. Please contact Makazii for assistance.",
      });
    }

    const counties = await prisma.county.findMany({
      where: { id: { in: countyIds } },
      select: { id: true, name: true },
    });

    if (counties.length !== countyIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more selected counties are invalid.",
      });
    }

    const existingQuestionnaire =
      landlord.questionnaire &&
      typeof landlord.questionnaire === "object" &&
      !Array.isArray(landlord.questionnaire)
        ? landlord.questionnaire as Record<string, unknown>
        : {};

    const updatedQuestionnaire = {
      ...existingQuestionnaire,
      propertyCounties: counties.map(({ id, name }) => ({ id, name })),
      propertyCountyCount: counties.length,
    };

    await prisma.landlord.update({
      where: { id: landlord.id },
      data: {
        questionnaire:
          updatedQuestionnaire as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "County selections saved. Your application remains subject to review.",
      data: {
        propertyCounties: counties,
        applicationStatus: landlord.applicationStatus,
      },
    });
  } catch (error) {
    console.error("Update landlord questionnaire error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update your county selections.",
    });
  }
}
