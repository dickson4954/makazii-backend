import { Router } from "express";
import { requireApprovedLandlord } from "../middleware/approvedLandlordMiddleware";

import { uploadPropertyImageController } from "../controllers/propertyImageController";
import { propertyImageUpload } from "../middleware/uploadMiddleware";
import {
requireAuth,
requireRole,
} from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireRole("LANDLORD"), requireApprovedLandlord);
router.post("/", propertyImageUpload.single("image"), uploadPropertyImageController);

export default router;
