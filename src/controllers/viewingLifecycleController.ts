import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * Convert a supplied scheduledAt value into a valid future Date.
 *
 * The marketer must always choose/confirm an actual appointment time.
 */
function parseScheduledAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (parsed.getTime() <= Date.now()) {
    return null;
  }

  return parsed;
}

/**
 * Format appointment time consistently for notifications.
 */
function formatScheduledTime(date: Date) {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

/**
 * Extract viewing ID from route params.
 */
function getViewingId(req: AuthenticatedRequest) {
  const value = req.params.viewingId;

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return value.trim();
}

/**
 * Find the authenticated marketer and make sure the account is active.
 */
async function getActiveMarketer(userId: string) {
  const marketer = await prisma.marketer.findUnique({
    where: {
      userId,
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          role: true,
          isActive: true,
          accountStatus: true,
        },
      },
    },
  });

  if (!marketer) {
    return null;
  }

  if (
    marketer.user.role !== "MARKETER" ||
    !marketer.user.isActive ||
    marketer.user.accountStatus !== "ACTIVE"
  ) {
    return null;
  }

  return marketer;
}

/**
 * POST /api/marketer/viewings/:viewingId/confirm
 *
 * Assigned marketer approves the requested/proposed appointment.
 *
 * ASSIGNED -> APPROVED
 *
 * This does NOT mean the physical viewing has happened.
 * The marketer must later use /complete after the actual viewing.
 */
export async function confirmMarketerViewing(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const viewingId = getViewingId(req);

    if (!viewingId) {
      return res.status(400).json({
        success: false,
        message: "Viewing ID is required",
      });
    }

    const userId = req.user.userId;

    const marketer = await getActiveMarketer(userId);

    if (!marketer) {
      return res.status(403).json({
        success: false,
        message: "Your marketer account is inactive or unavailable",
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
          },
        },
      },
    });

    if (!viewing) {
      return res.status(404).json({
        success: false,
        message: "Viewing request not found",
      });
    }

    if (viewing.assignedMarketerId !== marketer.id) {
      return res.status(403).json({
        success: false,
        message: "This viewing is not assigned to you",
      });
    }

    if (viewing.status === "COMPLETED") {
      return res.status(409).json({
        success: false,
        message: "This viewing has already been completed",
      });
    }

    if (viewing.status === "APPROVED") {
      return res.status(200).json({
        success: true,
        message: "Viewing is already approved",
        data: {
          viewingId: viewing.id,
          status: viewing.status,
          scheduledAt: viewing.scheduledAt,
          confirmedAt: viewing.confirmedAt,
        },
      });
    }

    if (viewing.status === "RESCHEDULED") {
      return res.status(409).json({
        success: false,
        message:
          "This viewing has already been rescheduled and cannot be approved again",
      });
    }

    if (viewing.status !== "ASSIGNED") {
      return res.status(409).json({
        success: false,
        message: `Viewing cannot be approved from status ${viewing.status}`,
      });
    }

    /*
     * The frontend should send:
     *
     * {
     *   "scheduledAt": "2026-10-10T08:00:00.000Z"
     * }
     *
     * scheduledAt is required because this is the actual appointment
     * time the marketer is approving.
     */
    const scheduledAt = parseScheduledAt(req.body?.scheduledAt);

    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        message:
          "A valid future scheduledAt date and time is required",
      });
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.viewingRequest.update({
        where: {
          id: viewing.id,
        },
        data: {
          status: "APPROVED",
          scheduledAt,
          confirmedAt: now,
        },
      });

      await tx.viewingStatusHistory.create({
        data: {
          viewingId: viewing.id,
          status: "APPROVED",
          note: `Viewing appointment approved by assigned marketer for ${formatScheduledTime(
            scheduledAt
          )}`,
          changedById: userId,
        },
      });

      await tx.notification.create({
        data: {
          userId: viewing.renterId,
          type: "VIEWING_CONFIRMED",
          title: "Viewing approved",
          message: `Your viewing for ${viewing.property.title} has been approved for ${formatScheduledTime(
            scheduledAt
          )}.`,
          entityType: "VIEWING",
          entityId: viewing.id,
        },
      });

      return result;
    });

    return res.status(200).json({
      success: true,
      message: "Viewing approved successfully",
      data: {
        viewingId: updated.id,
        status: updated.status,
        scheduledAt: updated.scheduledAt,
        confirmedAt: updated.confirmedAt,
      },
    });
  } catch (error) {
    console.error("confirmMarketerViewing error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve viewing",
    });
  }
}

/**
 * POST /api/marketer/viewings/:viewingId/reschedule
 *
 * Assigned marketer chooses a different future appointment time.
 *
 * ASSIGNED -> RESCHEDULED
 *
 * Rescheduling is a final scheduling decision. The viewing can
 * subsequently be marked COMPLETED after the actual viewing happens.
 */
export async function rescheduleMarketerViewing(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const viewingId = getViewingId(req);

    if (!viewingId) {
      return res.status(400).json({
        success: false,
        message: "Viewing ID is required",
      });
    }

    const userId = req.user.userId;

    const marketer = await getActiveMarketer(userId);

    if (!marketer) {
      return res.status(403).json({
        success: false,
        message: "Your marketer account is inactive or unavailable",
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
          },
        },
      },
    });

    if (!viewing) {
      return res.status(404).json({
        success: false,
        message: "Viewing request not found",
      });
    }

    if (viewing.assignedMarketerId !== marketer.id) {
      return res.status(403).json({
        success: false,
        message: "This viewing is not assigned to you",
      });
    }

    if (viewing.status === "COMPLETED") {
      return res.status(409).json({
        success: false,
        message: "This viewing has already been completed",
      });
    }

    if (viewing.status === "RESCHEDULED") {
      return res.status(409).json({
        success: false,
        message:
          "This viewing has already been rescheduled and cannot be rescheduled again",
      });
    }

    if (viewing.status === "APPROVED") {
      return res.status(409).json({
        success: false,
        message:
          "This viewing has already been approved and cannot be rescheduled from this state",
      });
    }

    if (viewing.status !== "ASSIGNED") {
      return res.status(409).json({
        success: false,
        message: `Viewing cannot be rescheduled from status ${viewing.status}`,
      });
    }

    const scheduledAt = parseScheduledAt(req.body?.scheduledAt);

    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        message:
          "A valid future scheduledAt date and time is required",
      });
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.viewingRequest.update({
        where: {
          id: viewing.id,
        },
        data: {
          status: "RESCHEDULED",
          scheduledAt,
          confirmedAt: now,
        },
      });

      await tx.viewingStatusHistory.create({
        data: {
          viewingId: viewing.id,
          status: "RESCHEDULED",
          note: `Viewing appointment rescheduled by assigned marketer to ${formatScheduledTime(
            scheduledAt
          )}`,
          changedById: userId,
        },
      });

      await tx.notification.create({
        data: {
          userId: viewing.renterId,
          type: "VIEWING_CONFIRMED",
          title: "Viewing rescheduled",
          message: `Your viewing for ${viewing.property.title} has been rescheduled to ${formatScheduledTime(
            scheduledAt
          )}.`,
          entityType: "VIEWING",
          entityId: viewing.id,
        },
      });

      return result;
    });

    return res.status(200).json({
      success: true,
      message: "Viewing rescheduled successfully",
      data: {
        viewingId: updated.id,
        status: updated.status,
        scheduledAt: updated.scheduledAt,
        confirmedAt: updated.confirmedAt,
      },
    });
  } catch (error) {
    console.error("rescheduleMarketerViewing error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reschedule viewing",
    });
  }
}

/**
 * POST /api/marketer/viewings/:viewingId/complete
 *
 * Assigned marketer confirms that the actual physical viewing
 * has taken place.
 *
 * APPROVED -> COMPLETED
 * RESCHEDULED -> COMPLETED
 */
export async function completeMarketerViewing(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const viewingId = getViewingId(req);

    if (!viewingId) {
      return res.status(400).json({
        success: false,
        message: "Viewing ID is required",
      });
    }

    const userId = req.user.userId;

    const marketer = await getActiveMarketer(userId);

    if (!marketer) {
      return res.status(403).json({
        success: false,
        message: "Your marketer account is inactive or unavailable",
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
          },
        },
      },
    });

    if (!viewing) {
      return res.status(404).json({
        success: false,
        message: "Viewing request not found",
      });
    }

    if (viewing.assignedMarketerId !== marketer.id) {
      return res.status(403).json({
        success: false,
        message: "This viewing is not assigned to you",
      });
    }

    if (viewing.status === "COMPLETED") {
      return res.status(200).json({
        success: true,
        message: "Viewing is already completed",
        data: {
          viewingId: viewing.id,
          status: viewing.status,
          completedAt: viewing.completedAt,
        },
      });
    }

    if (
      viewing.status !== "APPROVED" &&
      viewing.status !== "RESCHEDULED"
    ) {
      return res.status(409).json({
        success: false,
        message:
          `Viewing cannot be completed from status ${viewing.status}. ` +
          "The viewing must first be approved or rescheduled.",
      });
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.viewingRequest.update({
        where: {
          id: viewing.id,
        },
        data: {
          status: "COMPLETED",
          completedAt: now,
        },
      });

      await tx.viewingStatusHistory.create({
        data: {
          viewingId: viewing.id,
          status: "COMPLETED",
          note: "Actual viewing completed by assigned marketer",
          changedById: userId,
        },
      });

      await tx.notification.create({
        data: {
          userId: viewing.renterId,
          type: "VIEWING_COMPLETED",
          title: "Viewing completed",
          message: `Your viewing for ${viewing.property.title} has been marked as completed.`,
          entityType: "VIEWING",
          entityId: viewing.id,
        },
      });

      return result;
    });

    return res.status(200).json({
      success: true,
      message: "Viewing completed successfully",
      data: {
        viewingId: updated.id,
        status: updated.status,
        scheduledAt: updated.scheduledAt,
        confirmedAt: updated.confirmedAt,
        completedAt: updated.completedAt,
      },
    });
  } catch (error) {
    console.error("completeMarketerViewing error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to complete viewing",
    });
  }
}
