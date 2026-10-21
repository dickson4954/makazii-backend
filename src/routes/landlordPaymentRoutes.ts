import { Router } from "express";

import { getLandlordPayments } from "../controllers/landlordPaymentController";
import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware";
import { requireApprovedLandlord } from "../middleware/approvedLandlordMiddleware";

const router = Router();

router.use(
  requireAuth,
  requireRole("LANDLORD"),
  requireApprovedLandlord,
);

router.get("/", getLandlordPayments);

export default router;
