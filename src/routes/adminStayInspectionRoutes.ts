import { Router } from "express";

import {
  getAdminStayInspections,
  getAdminStayInspection,
  approveAdminStayInspection,
} from "../controllers/adminStayInspectionController";

import {
  requireAdmin,
  requireAuth,
} from "../middleware/authMiddleware";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireAdmin,
  getAdminStayInspections
);

router.get(
  "/:inspectionId",
  requireAuth,
  requireAdmin,
  getAdminStayInspection
);

router.post(
  "/:inspectionId/approve",
  requireAuth,
  requireAdmin,
  approveAdminStayInspection
);

export default router;
