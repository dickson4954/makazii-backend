import { Router } from "express";

import {
  createCustomerViewingProblemReport,
} from "../controllers/customerProblemReportController";

import {
  requireAuth,
  requireCustomer,
} from "../middleware/authMiddleware";

const router = Router();

router.post(
  "/viewings/:viewingId",
  requireAuth,
  requireCustomer,
  createCustomerViewingProblemReport,
);

export default router;
