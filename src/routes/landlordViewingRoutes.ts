import { Router } from "express";
import { requireApprovedLandlord } from "../middleware/approvedLandlordMiddleware";

import {
  getLandlordViewing,
  getLandlordViewings,
} from "../controllers/landlordViewingController";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireRole("LANDLORD"), requireApprovedLandlord);

router.get("/", getLandlordViewings);
router.get("/:viewingId", getLandlordViewing);

export default router;
