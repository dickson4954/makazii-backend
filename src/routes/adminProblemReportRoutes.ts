import { Router } from "express";

import {
  getAdminProblemReports,
  getAdminProblemReport,
  updateAdminProblemReport,
} from "../controllers/adminProblemReportController";

import {
  requireAuth,
  requireAdmin,
} from "../middleware/authMiddleware";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireAdmin,
  getAdminProblemReports,
);

router.get(
  "/:id",
  requireAuth,
  requireAdmin,
  getAdminProblemReport,
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  updateAdminProblemReport,
);

export default router;
