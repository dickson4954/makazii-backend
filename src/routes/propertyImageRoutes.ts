import { Router } from "express";

import { uploadPropertyImageController } from "../controllers/propertyImageController";
import { propertyImageUpload } from "../middleware/uploadMiddleware";
import {
  requireAdmin,
  requireAuth,
} from "../middleware/authMiddleware";

const router = Router();

/**
 * PROPERTY IMAGE UPLOAD
 *
 * Admin-only for now.
 * Marketer access can be added later using the same
 * upload infrastructure with marketer authorization.
 */
router.use(requireAuth, requireAdmin);

router.post(
  "/",
  propertyImageUpload.single("image"),
  uploadPropertyImageController
);

export default router;
