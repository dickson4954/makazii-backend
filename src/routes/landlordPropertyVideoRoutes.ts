import { Router } from "express";

import { uploadPropertyVideoController } from "../controllers/propertyVideoUploadController";
import { propertyVideoUpload } from "../middleware/propertyVideoUploadMiddleware";
import { requireApprovedLandlord } from "../middleware/approvedLandlordMiddleware";
import { requireAuth, requireRole } from "../middleware/authMiddleware";

const router = Router();

router.use(
  requireAuth,
  requireRole("LANDLORD"),
  requireApprovedLandlord
);

router.post(
  "/",
  propertyVideoUpload.single("video"),
  uploadPropertyVideoController
);

export default router;
