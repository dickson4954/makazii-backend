import { Router } from "express";

import {
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAdminNotification,
} from "../controllers/adminNotificationController";

import {
  requireAdmin,
  requireAuth,
} from "../middleware/authMiddleware";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireAdmin,
  getAdminNotifications
);

router.patch(
  "/read-all",
  requireAuth,
  requireAdmin,
  markAllAdminNotificationsRead
);

router.patch(
  "/:notificationId/read",
  requireAuth,
  requireAdmin,
  markAdminNotificationRead
);

router.delete(
  "/:notificationId",
  requireAuth,
  requireAdmin,
  deleteAdminNotification
);

export default router;
