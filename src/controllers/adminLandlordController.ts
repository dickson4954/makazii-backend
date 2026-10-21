import type { Request, Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { AccountStatus, LandlordApplicationStatus, LandlordIdVerificationStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

function queryString(value: unknown): string {
return typeof value === "string" ? value.trim() : "";
}

export async function getAdminLandlords(
req: Request,
res: Response,
) {
try {
const search = queryString(req.query.search);
const applicationStatus = queryString(req.query.applicationStatus);
const idVerificationStatus = queryString(req.query.idVerificationStatus);
const accountStatus = queryString(req.query.accountStatus);

const where: Prisma.LandlordWhereInput = {
  ...(applicationStatus
    ? { applicationStatus: applicationStatus as LandlordApplicationStatus }
    : {}),
  ...(idVerificationStatus
    ? { idVerificationStatus: idVerificationStatus as LandlordIdVerificationStatus }
    : {}),
  ...(accountStatus
    ? { user: { accountStatus: accountStatus as AccountStatus } }
    : {}),
  ...(search
    ? {
        OR: [
          { user: { firstName: { contains: search, mode: "insensitive" } } },
          { user: { lastName: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
          { user: { phone: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {}),
};

const [
  total,
  pending,
  underReview,
  approved,
  rejected,
  pendingIds,
  verifiedIds,
  landlords,
] = await prisma.$transaction([
  prisma.landlord.count(),
  prisma.landlord.count({ where: { applicationStatus: "PENDING" } }),
  prisma.landlord.count({ where: { applicationStatus: "UNDER_REVIEW" } }),
  prisma.landlord.count({ where: { applicationStatus: "APPROVED" } }),
  prisma.landlord.count({ where: { applicationStatus: "REJECTED" } }),
  prisma.landlord.count({ where: { idVerificationStatus: "PENDING" } }),
  prisma.landlord.count({ where: { idVerificationStatus: "VERIFIED" } }),
  prisma.landlord.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      applicationStatus: true,
      idVerificationStatus: true,
      reviewNotes: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          accountStatus: true,
          isActive: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      },
      _count: { select: { properties: true } },
    },
  }),
]);

return res.status(200).json({
  summary: {
    total,
    pending,
    underReview,
    approved,
    rejected,
    pendingIds,
    verifiedIds,
  },
  landlords: landlords.map(({ _count, ...landlord }) => ({
    ...landlord,
    propertyCount: _count.properties,
  })),
});

} catch (error) {
console.error("getAdminLandlords error:", error);
return res.status(500).json({
message: "Failed to load landlord applications.",
});
}
}

export async function getAdminLandlord(
req: Request,
res: Response,
) {
try {
const landlordId = queryString(req.params.landlordId);

const landlord = await prisma.landlord.findUnique({
  where: { id: landlordId },
  select: {
    id: true,
    questionnaire: true,
    applicationStatus: true,
    idVerificationStatus: true,
    idVerificationMessage: true,
    reviewNotes: true,
    reviewedAt: true,
    reviewedById: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        accountStatus: true,
        statusReason: true,
        statusChangedAt: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        statusHistory: {
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            reason: true,
            changedById: true,
            createdAt: true,
          },
        },
      },
    },
    properties: {
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        purpose: true,
        status: true,
        monthlyRent: true,
        dayRate: true,
        nightRate: true,
        county: true,
        town: true,
        area: true,
        verified: true,
        available: true,
        createdAt: true,
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            fromStatus: true,
            toStatus: true,
            note: true,
            changedById: true,
            createdAt: true,
          },
        },
      },
    },
  },
});

if (!landlord) {
  return res.status(404).json({
    message: "Landlord application not found.",
  });
}

return res.status(200).json({ landlord });

} catch (error) {
console.error("getAdminLandlord error:", error);
return res.status(500).json({
message: "Failed to load landlord details.",
});
}
}

export async function getAdminLandlordPerformance(
req: Request,
res: Response,
) {
try {
const landlordId = queryString(req.params.landlordId);

const landlord = await prisma.landlord.findUnique({
  where: { id: landlordId },
  select: { id: true },
});

if (!landlord) {
  return res.status(404).json({
    message: "Landlord not found.",
  });
}

const propertyWhere = { landlordId };

const [
  propertyTotal,
  propertyStatuses,
  viewingTotal,
  viewingCompleted,
  viewingCancelled,
  inspectionTotal,
  inspectionCompleted,
  inspectionCancelled,
  bookingTotal,
  bookingCompleted,
  bookingCancelled,
  paymentGroups,
  recentProperties,
] = await prisma.$transaction([
  prisma.property.count({ where: propertyWhere }),
  prisma.property.groupBy({
    by: ["status"],
    where: propertyWhere,
    _count: { _all: true },
  }),
  prisma.viewingRequest.count({
    where: { property: propertyWhere },
  }),
  prisma.viewingRequest.count({
    where: { property: propertyWhere, status: "COMPLETED" },
  }),
  prisma.viewingRequest.count({
    where: { property: propertyWhere, status: "CANCELLED" },
  }),
  prisma.stayInspection.count({
    where: { property: propertyWhere },
  }),
  prisma.stayInspection.count({
    where: { property: propertyWhere, status: "COMPLETED" },
  }),
  prisma.stayInspection.count({
    where: { property: propertyWhere, status: "CANCELLED" },
  }),
  prisma.stayBooking.count({
    where: { property: propertyWhere },
  }),
  prisma.stayBooking.count({
    where: { property: propertyWhere, status: "COMPLETED" },
  }),
  prisma.stayBooking.count({
    where: { property: propertyWhere, status: "CANCELLED" },
  }),
  prisma.payment.groupBy({
    by: ["status", "currency"],
    where: {
      OR: [
        { viewingRequest: { property: propertyWhere } },
        { stayInspection: { property: propertyWhere } },
        { stayBooking: { property: propertyWhere } },
      ],
    },
    _count: { _all: true },
    _sum: { amount: true },
  }),
  prisma.property.findMany({
    where: propertyWhere,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      status: true,
      purpose: true,
      county: true,
      town: true,
      createdAt: true,
    },
  }),
]);

return res.status(200).json({
  landlordId,
  properties: {
    total: propertyTotal,
    byStatus: propertyStatuses.map((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    recent: recentProperties,
  },
  viewings: {
    total: viewingTotal,
    completed: viewingCompleted,
    cancelled: viewingCancelled,
  },
  inspections: {
    total: inspectionTotal,
    completed: inspectionCompleted,
    cancelled: inspectionCancelled,
  },
  bookings: {
    total: bookingTotal,
    completed: bookingCompleted,
    cancelled: bookingCancelled,
  },
  payments: paymentGroups.map((item) => ({
    status: item.status,
    currency: item.currency,
    count: item._count._all,
    amount: item._sum.amount ?? 0,
  })),
  note: "Payment totals represent recorded customer payments linked to this landlord's properties. They are not necessarily landlord earnings or payouts.",
});

} catch (error) {
console.error("getAdminLandlordPerformance error:", error);
return res.status(500).json({
message: "Failed to load landlord performance.",
});
}
}


/**
 * Shared guard for application decisions.
 */
async function findLandlordForDecision(
  landlordId: string,
  res: Response,
) {
  const landlord = await prisma.landlord.findUnique({
    where: { id: landlordId },
    select: {
      id: true,
      applicationStatus: true,
      idVerificationStatus: true,
    },
  });

  if (!landlord) {
    res.status(404).json({
      success: false,
      message: "Landlord application not found.",
    });
    return null;
  }

  return landlord;
}

function adminUserId(req: AuthenticatedRequest): string | null {
  return req.user?.userId ?? null;
}

/**
 * PATCH /api/admin/landlords/:landlordId/review
 */
export async function reviewAdminLandlordApplication(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const landlordId = queryString(req.params.landlordId);
    const adminId = adminUserId(req);
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const landlord = await findLandlordForDecision(landlordId, res);
    if (!landlord) return;

    if (["APPROVED", "REJECTED"].includes(landlord.applicationStatus)) {
      return res.status(409).json({
        success: false,
        message: "A completed application cannot be moved back into review.",
      });
    }

    const updated = await prisma.landlord.update({
      where: { id: landlordId },
      data: {
        applicationStatus: "UNDER_REVIEW",
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
      select: {
        id: true,
        applicationStatus: true,
        idVerificationStatus: true,
        reviewedAt: true,
        reviewedById: true,
      },
    });

    return res.json({
      success: true,
      message: "Landlord application moved to review.",
      landlord: updated,
    });
  } catch (error) {
    console.error("Review landlord application error:", error);
    return res.status(500).json({ success: false, message: "Failed to review landlord application." });
  }
}

/**
 * PATCH /api/admin/landlords/:landlordId/id-verification
 * Body: { status: VERIFIED | REVIEW | REJECTED, message?: string }
 */
export async function updateAdminLandlordIdVerification(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const landlordId = queryString(req.params.landlordId);
    const status = queryString(req.body?.status);
    const message = queryString(req.body?.message);

    if (!["VERIFIED", "REVIEW", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be VERIFIED, REVIEW, or REJECTED.",
      });
    }

    if (status !== "VERIFIED" && !message) {
      return res.status(400).json({
        success: false,
        message: "Provide a message explaining the ID verification decision.",
      });
    }

    const landlord = await findLandlordForDecision(landlordId, res);
    if (!landlord) return;

    const updated = await prisma.landlord.update({
      where: { id: landlordId },
      data: {
        idVerificationStatus: status as LandlordIdVerificationStatus,
        idVerificationMessage: message || null,
      },
      select: {
        id: true,
        applicationStatus: true,
        idVerificationStatus: true,
        idVerificationMessage: true,
      },
    });

    return res.json({
      success: true,
      message: "Landlord identity verification updated.",
      landlord: updated,
    });
  } catch (error) {
    console.error("Update landlord ID verification error:", error);
    return res.status(500).json({ success: false, message: "Failed to update ID verification." });
  }
}

/**
 * PATCH /api/admin/landlords/:landlordId/request-changes
 * Body: { message: string }
 */
export async function requestAdminLandlordChanges(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const landlordId = queryString(req.params.landlordId);
    const adminId = adminUserId(req);
    const message = queryString(req.body?.message);

    if (!adminId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: "A message describing the required changes is required." });
    }

    const landlord = await findLandlordForDecision(landlordId, res);
    if (!landlord) return;

    if (["APPROVED", "REJECTED"].includes(landlord.applicationStatus)) {
      return res.status(409).json({
        success: false,
        message: "A completed application cannot be changed.",
      });
    }

    const updated = await prisma.landlord.update({
      where: { id: landlordId },
      data: {
        applicationStatus: "ACTION_REQUIRED",
        reviewNotes: message,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
      select: {
        id: true,
        applicationStatus: true,
        reviewNotes: true,
        reviewedAt: true,
        reviewedById: true,
      },
    });

    return res.json({
      success: true,
      message: "Changes requested from the landlord.",
      landlord: updated,
    });
  } catch (error) {
    console.error("Request landlord changes error:", error);
    return res.status(500).json({ success: false, message: "Failed to request changes." });
  }
}

/**
 * PATCH /api/admin/landlords/:landlordId/approve
 * Identity verification must already be VERIFIED.
 */
export async function approveAdminLandlordApplication(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const landlordId = queryString(req.params.landlordId);
    const adminId = adminUserId(req);
    const notes = queryString(req.body?.adminNotes);

    if (!adminId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const landlord = await findLandlordForDecision(landlordId, res);
    if (!landlord) return;

    if (landlord.applicationStatus === "REJECTED") {
      return res.status(409).json({ success: false, message: "A rejected application cannot be approved." });
    }
    if (landlord.applicationStatus === "APPROVED") {
      return res.status(409).json({ success: false, message: "This application is already approved." });
    }
    if (landlord.idVerificationStatus !== "VERIFIED") {
      return res.status(409).json({
        success: false,
        message: "Verify the landlord's identity before approving the application.",
      });
    }

    const updated = await prisma.landlord.update({
      where: { id: landlordId },
      data: {
        applicationStatus: "APPROVED",
        reviewNotes: notes || null,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
      select: {
        id: true,
        applicationStatus: true,
        idVerificationStatus: true,
        reviewNotes: true,
        reviewedAt: true,
        reviewedById: true,
      },
    });

    return res.json({
      success: true,
      message: "Landlord application approved.",
      landlord: updated,
    });
  } catch (error) {
    console.error("Approve landlord application error:", error);
    return res.status(500).json({ success: false, message: "Failed to approve landlord application." });
  }
}

/**
 * PATCH /api/admin/landlords/:landlordId/reject
 * Body: { rejectionReason: string }
 */
export async function rejectAdminLandlordApplication(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const landlordId = queryString(req.params.landlordId);
    const adminId = adminUserId(req);
    const rejectionReason = queryString(req.body?.rejectionReason);

    if (!adminId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    if (!rejectionReason) {
      return res.status(400).json({ success: false, message: "A rejection reason is required." });
    }

    const landlord = await findLandlordForDecision(landlordId, res);
    if (!landlord) return;

    if (["APPROVED", "REJECTED"].includes(landlord.applicationStatus)) {
      return res.status(409).json({
        success: false,
        message: "This application has already received a final decision.",
      });
    }

    const updated = await prisma.landlord.update({
      where: { id: landlordId },
      data: {
        applicationStatus: "REJECTED",
        reviewNotes: rejectionReason,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
      select: {
        id: true,
        applicationStatus: true,
        reviewNotes: true,
        reviewedAt: true,
        reviewedById: true,
      },
    });

    return res.json({
      success: true,
      message: "Landlord application rejected.",
      landlord: updated,
    });
  } catch (error) {
    console.error("Reject landlord application error:", error);
    return res.status(500).json({ success: false, message: "Failed to reject landlord application." });
  }
}

/**
 * Private document access. The reference must match the generated
 * private://landlord-ids/<random-folder>/<side>.<extension> format.
 */
export async function getAdminLandlordIdDocument(
  req: Request,
  res: Response,
  side: "front" | "back",
) {
  try {
    const landlordId = queryString(req.params.landlordId);
    const landlord = await prisma.landlord.findUnique({
      where: { id: landlordId },
      select: {
        idFrontReference: true,
        idBackReference: true,
      },
    });

    if (!landlord) {
      return res.status(404).json({ success: false, message: "Landlord application not found." });
    }

    const reference = side === "front"
      ? landlord.idFrontReference
      : landlord.idBackReference;

    const match = typeof reference === "string"
      ? reference.match(/^private:\/\/landlord-ids\/([a-f0-9]{32})\/(front|back)\.(jpg|jpeg|png|webp)$/)
      : null;

    if (!match || match[2] !== side) {
      return res.status(404).json({ success: false, message: "Identity document not found." });
    }

    const [, folderId, , extension] = match;
    const root = path.resolve(process.cwd(), "storage", "private", "landlord-ids");
    const applicationDirectory = path.resolve(root, folderId);
    const filePath = path.resolve(applicationDirectory, `${side}.${extension}`);

    if (!applicationDirectory.startsWith(`${root}${path.sep}`) ||
        !filePath.startsWith(`${applicationDirectory}${path.sep}`)) {
      return res.status(404).json({ success: false, message: "Identity document not found." });
    }

    await fs.access(filePath);

    const contentType: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", contentType[extension]);

    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ success: false, message: "Identity document could not be served." });
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return res.status(404).json({ success: false, message: "Identity document file not found." });
    }
    console.error("Get landlord ID document error:", error);
    return res.status(500).json({ success: false, message: "Failed to load identity document." });
  }
}
