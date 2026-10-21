import { Router } from "express";

import {
  getLandlordProblemReports,
} from "../controllers/landlordProblemReportController";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware";

import {
  requireApprovedLandlord,
} from "../middleware/approvedLandlordMiddleware";

const router = Router();

router.use(
  requireAuth,
  requireRole("LANDLORD"),
  requireApprovedLandlord,
);

router.get("/", getLandlordProblemReports);

export default router;
