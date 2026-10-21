import { Router } from "express";
import { requireApprovedLandlord } from "../middleware/approvedLandlordMiddleware";

import {
  getLandlordStayInspection,
  getLandlordStayInspections,
} from "../controllers/landlordStayInspectionController";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireRole("LANDLORD"), requireApprovedLandlord);

router.get("/", getLandlordStayInspections);
router.get("/:inspectionId", getLandlordStayInspection);

export default router;
