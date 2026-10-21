import { Router } from "express";

import { uploadPropertyImageController } from "../controllers/propertyImageController";
import { propertyImageUpload } from "../middleware/uploadMiddleware";
import {
  requireAuth,
  requireMarketer,
  requireActiveMarketer,
} from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireMarketer, requireActiveMarketer);

router.post(
  "/",
  propertyImageUpload.single("image"),
  uploadPropertyImageController
);

export default router;
