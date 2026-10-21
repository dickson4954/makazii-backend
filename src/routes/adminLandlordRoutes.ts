import { Router } from "express";

import {
  approveAdminLandlordApplication,
  getAdminLandlord,
  getAdminLandlordIdDocument,
  getAdminLandlordPerformance,
  getAdminLandlords,
  rejectAdminLandlordApplication,
  requestAdminLandlordChanges,
  reviewAdminLandlordApplication,
  updateAdminLandlordIdVerification,
} from "../controllers/adminLandlordController";

import { requireAdmin, requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", getAdminLandlords);
router.get("/:landlordId/performance", getAdminLandlordPerformance);
router.get("/:landlordId/id/front", (req, res) =>
  getAdminLandlordIdDocument(req, res, "front")
);
router.get("/:landlordId/id/back", (req, res) =>
  getAdminLandlordIdDocument(req, res, "back")
);
router.patch("/:landlordId/id-verification", updateAdminLandlordIdVerification);
router.patch("/:landlordId/review", reviewAdminLandlordApplication);
router.patch("/:landlordId/request-changes", requestAdminLandlordChanges);
router.patch("/:landlordId/approve", approveAdminLandlordApplication);
router.patch("/:landlordId/reject", rejectAdminLandlordApplication);
router.get("/:landlordId", getAdminLandlord);

export default router;
