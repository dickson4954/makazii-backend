import { Router } from "express";
import { requireApprovedLandlord } from "../middleware/approvedLandlordMiddleware";

import { getAmenities } from "../controllers/amenityController";
import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireRole("LANDLORD"), requireApprovedLandlord);

router.get("/", getAmenities);

export default router;
