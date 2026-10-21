import { Router } from "express";

import {
  getCustomerShortlist,
  addCustomerShortlist,
  removeCustomerShortlist,
  clearCustomerShortlist,
} from "../controllers/customerShortlistController";

import {
  requireAuth,
  requireCustomer,
} from "../middleware/authMiddleware";

const router = Router();

/**
 * CUSTOMER SHORTLIST
 *
 * GET    /api/customer/shortlist
 * POST   /api/customer/shortlist/:propertyId
 * DELETE /api/customer/shortlist/:propertyId
 * DELETE /api/customer/shortlist
 *
 * Shortlists always belong to the authenticated
 * RENTER. Property details are never exposed here.
 */

router.use(requireAuth, requireCustomer);

router.get("/", getCustomerShortlist);

router.post(
  "/:propertyId",
  addCustomerShortlist,
);

router.delete(
  "/:propertyId",
  removeCustomerShortlist,
);

router.delete(
  "/",
  clearCustomerShortlist,
);

export default router;
