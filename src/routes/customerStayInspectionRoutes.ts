import { Router } from "express";

import {
  requireAuth,
  requireCustomer,
} from "../middleware/authMiddleware";

import {
  createCustomerStayInspection,
  getCustomerStayInspection,
  getCustomerStayInspections,
} from "../controllers/customerStayInspectionController";

const router = Router();

router.use(requireAuth);
router.use(requireCustomer);

router.post(
  "/",
  createCustomerStayInspection
);

router.get(
  "/",
  getCustomerStayInspections
);

router.get(
  "/:inspectionId",
  getCustomerStayInspection
);

export default router;
