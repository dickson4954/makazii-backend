import { Router } from "express";

import {
  getAdminViewings,
  getAdminViewing,
  approveAdminViewing,
} from "../controllers/adminViewingController";

import {
  requireAdmin,
  requireAuth,
} from "../middleware/authMiddleware";

const router = Router();

/**
 * GET /api/admin/viewings
 *
 * Admin viewing list.
 */
router.get(
  "/",
  requireAuth,
  requireAdmin,
  getAdminViewings
);

/**
 * GET /api/admin/viewings/:viewingId
 *
 * Admin viewing details.
 */
router.get(
  "/:viewingId",
  requireAuth,
  requireAdmin,
  getAdminViewing
);

/**
 * POST /api/admin/viewings/:viewingId/approve
 *
 * Approves a PAID viewing and automatically assigns
 * the property's source marketer.
 */
router.post(
  "/:viewingId/approve",
  requireAuth,
  requireAdmin,
  approveAdminViewing
);

export default router;
