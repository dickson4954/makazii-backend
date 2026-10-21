import { Router } from "express";
import { requireApprovedLandlord } from "../middleware/approvedLandlordMiddleware";

import { getLandlordDashboard } from "../controllers/landlordDashboardController";
import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireRole("LANDLORD"), requireApprovedLandlord);

router.get("/", getLandlordDashboard);

export default router;
