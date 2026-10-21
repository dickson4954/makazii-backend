import { Router } from "express";
import { propertyImageUpload } from "../middleware/uploadMiddleware";

import {
  requireAuth,
  requireAdmin,
} from "../middleware/authMiddleware";

import {
  getCounties,
  createCounty,
  getPlacesByCounty,
  createPlace,
  uploadCountyCover,
} from "../controllers/geographyController";

const router = Router();

/**
 * All geography management routes require:
 *
 * 1. Valid JWT
 * 2. ADMIN role
 */
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/counties
 */
router.get("/", getCounties);

/**
 * POST /api/admin/counties
 */
router.post("/", createCounty);

/**
 * PATCH /api/admin/counties/:countyId/cover
 * Multipart field: image
 */
router.patch(
  "/:countyId/cover",
  propertyImageUpload.single("image"),
  uploadCountyCover
);

/**
 * GET /api/admin/counties/:countyId/places
 */
router.get("/:countyId/places", getPlacesByCounty);

/**
 * POST /api/admin/counties/:countyId/places
 */
router.post("/:countyId/places", createPlace);

export default router;
