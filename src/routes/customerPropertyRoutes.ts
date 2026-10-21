import { Router } from "express";

import {
  getCustomerProperties,
  getCustomerProperty,
} from "../controllers/customerPropertyController";

const router = Router();

/**
 * PUBLIC CUSTOMER PROPERTY BROWSING
 *
 * GET /api/properties
 * GET /api/properties/:id
 *
 * Only ACTIVE + available + verified properties
 * are returned.
 *
 * No marketer, landlord, creator or verification
 * contact information is exposed.
 */

router.get("/", getCustomerProperties);
router.get("/:id", getCustomerProperty);

export default router;
