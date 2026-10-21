import type { Response } from "express";

import {
  NotificationType,
} from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * GET /api/admin/notifications
 *
 * Returns notifications belonging to the authenticated admin.
 *
 * Optional:
 *   ?unread=true
 *   ?type=VIEWING_PAID
 */
export async function getAdminNotifications(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated admin user not found",
      });
    }

    const unread =
      typeof req.query.unread === "string"
        ? req.query.unread.trim().toLowerCase()
        : undefined;

    const typeValue =
      typeof req.query.type === "string"
        ? req.query.type.trim()
        : undefined;

    const where: {
      userId: string;
      readAt?: null;
      type?: NotificationType;
    } = {
      userId,
    };

    if (unread === "true") {
      where.readAt = null;
    }

    if (
      typeValue &&
      Object.values(NotificationType).includes(
        typeValue as NotificationType
      )
    ) {
      where.type = typeValue as NotificationType;
    }

    const notifications =
      await prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
      });

    const unreadCount =
      await prisma.notification.count({
        where: {
          userId,
          readAt: null,
        },
      });

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        count: notifications.length,
        unreadCount,
      },
    });
  } catch (error) {
    console.error(
      "getAdminNotifications error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load admin notifications",
    });
  }
}

/**
 * PATCH /api/admin/notifications/:notificationId/read
 *
 * Marks one notification as read.
 */
export async function markAdminNotificationRead(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;
    const notificationId = req.params.notificationId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated admin user not found",
      });
    }

    if (
      typeof notificationId !== "string" ||
      notificationId.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    const notification =
      await prisma.notification.findFirst({
        where: {
          id: notificationId.trim(),
          userId,
        },
      });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const updated =
      await prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          readAt:
            notification.readAt ?? new Date(),
        },
      });

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: {
        notification: updated,
      },
    });
  } catch (error) {
    console.error(
      "markAdminNotificationRead error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
}

/**
 * PATCH /api/admin/notifications/read-all
 *
 * Marks every unread notification belonging
 * to the authenticated admin as read.
 */
export async function markAllAdminNotificationsRead(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated admin user not found",
      });
    }

    const result =
      await prisma.notification.updateMany({
        where: {
          userId,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: {
        updatedCount: result.count,
      },
    });
  } catch (error) {
    console.error(
      "markAllAdminNotificationsRead error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
}

/**
 * DELETE /api/admin/notifications/:notificationId
 *
 * Deletes one notification belonging
 * to the authenticated admin.
 */
export async function deleteAdminNotification(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.userId;
    const notificationId = req.params.notificationId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated admin user not found",
      });
    }

    if (
      typeof notificationId !== "string" ||
      notificationId.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    const notification =
      await prisma.notification.findFirst({
        where: {
          id: notificationId.trim(),
          userId,
        },
        select: {
          id: true,
        },
      });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await prisma.notification.delete({
      where: {
        id: notification.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error(
      "deleteAdminNotification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
}
