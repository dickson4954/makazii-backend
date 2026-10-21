import { Router } from "express";

import { uploadPropertyVideoController } from "../controllers/propertyVideoUploadController";
import { propertyVideoUpload } from "../middleware/propertyVideoUploadMiddleware";
import {
  requireAuth,
  requireMarketer,
  requireActiveMarketer,
} from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireMarketer, requireActiveMarketer);

router.post(
  "/",
  propertyVideoUpload.single("video"),
  uploadPropertyVideoController
);

export default router;
