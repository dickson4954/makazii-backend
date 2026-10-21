import { Router } from "express";

import { getAmenities } from "../controllers/amenityController";
import {
  requireAdmin,
  requireAuth,
  requireMarketer,
} from "../middleware/authMiddleware";

const router = Router();

/**
 * All admin amenity endpoints require
 * an authenticated ADMIN user.
 */
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/amenities
 *
 * Returns the shared MAKAZII amenity catalogue
 * for property creation/editing.
 */
router.get("/", getAmenities);

export default router;
