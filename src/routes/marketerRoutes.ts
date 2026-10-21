import { Router } from "express";

import {
  requireAuth,
  requireAdmin,
} from "../middleware/authMiddleware";

import {
  createMarketer,
  getMarketers,
  getMarketer,
  updateMarketer,
  approveMarketer,
  deactivateMarketer,
  getMarketerPlaces,
  assignMarketerPlaces,
  removeMarketerPlace,
} from "../controllers/marketerController";

const router = Router();

/**
 * =========================================================
 * ADMIN MARKETER ROUTES
 * =========================================================
 *
 * Base path:
 * /api/admin/marketers
 *
 * Every route below requires:
 * 1. Valid JWT
 * 2. ADMIN role
 */
router.use(requireAuth);
router.use(requireAdmin);

/**
 * =========================================================
 * MARKETER MANAGEMENT
 * =========================================================
 */

/**
 * POST /api/admin/marketers
 *
 * Create a new marketer.
 *
 * New marketers are created inactive and must be
 * approved by an administrator.
 */
router.post("/", createMarketer);

/**
 * GET /api/admin/marketers
 *
 * Get all marketers.
 */
router.get("/", getMarketers);

/**
 * GET /api/admin/marketers/:id
 *
 * Get one marketer with:
 * - user information
 * - assigned places
 * - properties
 * - viewings
 * - counts
 */
router.get("/:id", getMarketer);

/**
 * PATCH /api/admin/marketers/:id
 *
 * Update editable marketer information.
 *
 * Body:
 * {
 *   firstName?: string,
 *   lastName?: string,
 *   email?: string,
 *   phone?: string,
 *   notes?: string
 * }
 *
 * Coverage is managed separately.
 */
router.patch("/:id", updateMarketer);

/**
 * PATCH /api/admin/marketers/:id/approve
 *
 * Approve/activate a marketer.
 */
router.patch("/:id/approve", approveMarketer);

/**
 * PATCH /api/admin/marketers/:id/deactivate
 *
 * Deactivate an active marketer.
 */
router.patch("/:id/deactivate", deactivateMarketer);

/**
 * =========================================================
 * MARKETER PLACE ASSIGNMENTS
 * =========================================================
 */

/**
 * GET /api/admin/marketers/:id/places
 *
 * Get all places currently assigned to a marketer.
 */
router.get("/:id/places", getMarketerPlaces);

/**
 * POST /api/admin/marketers/:id/places
 *
 * Assign one or more places to a marketer.
 *
 * Body:
 * {
 *   "placeIds": ["place-id-1", "place-id-2"]
 * }
 */
router.post("/:id/places", assignMarketerPlaces);

/**
 * DELETE /api/admin/marketers/:id/places/:placeId
 *
 * Remove a place assignment from a marketer.
 */
router.delete("/:id/places/:placeId", removeMarketerPlace);

export default router;
