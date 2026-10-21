import { Router } from "express";
import { requireApprovedLandlord } from "../middleware/approvedLandlordMiddleware";

import {
  createLandlordProperty,
  getLandlordProperties,
  getLandlordProperty,
} from "../controllers/landlordPropertyController";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireRole("LANDLORD"), requireApprovedLandlord);

router.get("/", getLandlordProperties);
router.get("/:id", getLandlordProperty);
router.post("/", createLandlordProperty);

export default router;
