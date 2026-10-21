import { Router } from "express";

import {
  getPublicCounties,
  getPublicConstituenciesByCounty,
  getPublicWardsByConstituency,
  getPublicPlacesByCounty,
} from "../controllers/publicGeographyController";

const router = Router();

/**
 * PUBLIC GEOGRAPHY
 *
 * These routes are intentionally public.
 * They are used by applicants before they have an account.
 */

router.get("/counties", getPublicCounties);

router.get(
  "/counties/:countyId/constituencies",
  getPublicConstituenciesByCounty
);

router.get(
  "/constituencies/:constituencyId/wards",
  getPublicWardsByConstituency
);

/**
 * Existing Place endpoint retained.
 */
router.get(
  "/counties/:countyId/places",
  getPublicPlacesByCounty
);

export default router;
