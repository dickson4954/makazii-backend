import { Router } from "express";

import {
  requireAuth,
  requireAdmin,
} from "../middleware/authMiddleware";

import {
  getAllProfileChangeRequestsController,
  approveProfileChangeRequestController,
  rejectProfileChangeRequestController,
} from "../controllers/marketerProfileChangeController";

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/marketers/profile-change-requests
 *
 * Optional:
 * ?status=PENDING
 * ?status=APPROVED
 * ?status=REJECTED
 */
router.get(
  "/",
  getAllProfileChangeRequestsController
);

/**
 * PATCH /api/admin/marketers/profile-change-requests/:id/approve
 */
router.patch(
  "/:id/approve",
  approveProfileChangeRequestController
);

/**
 * PATCH /api/admin/marketers/profile-change-requests/:id/reject
 */
router.patch(
  "/:id/reject",
  rejectProfileChangeRequestController
);

export default router;
