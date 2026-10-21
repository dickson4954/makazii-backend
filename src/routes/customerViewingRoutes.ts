import { Router } from "express";

import {
  createCustomerViewing,
  getCustomerViewings,
  getCustomerViewing,
} from "../controllers/customerViewingController";

import {
  requireAuth,
  requireCustomer,
} from "../middleware/authMiddleware";

const router = Router();

/**
 * Customer viewing requests
 *
 * GET /api/viewings
 * Customer sees their own viewing requests.
 *
 * GET /api/viewings/:viewingId
 * Customer sees one of their own viewing requests.
 *
 * POST /api/viewings
 * Customer creates a viewing request.
 *
 * IMPORTANT:
 * The customer does NOT choose or assign a marketer.
 * Marketer assignment happens only after payment
 * and admin approval.
 */

router.get(
  "/",
  requireAuth,
  requireCustomer,
  getCustomerViewings
);

router.get(
  "/:viewingId",
  requireAuth,
  requireCustomer,
  getCustomerViewing
);

router.post(
  "/",
  requireAuth,
  requireCustomer,
  createCustomerViewing
);

export default router;
