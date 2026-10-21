import { Router } from "express";

import { uploadPropertyVideoController } from "../controllers/propertyVideoUploadController";
import { propertyVideoUpload } from "../middleware/propertyVideoUploadMiddleware";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireAdmin);

router.post(
  "/",
  propertyVideoUpload.single("video"),
  uploadPropertyVideoController
);

export default router;
