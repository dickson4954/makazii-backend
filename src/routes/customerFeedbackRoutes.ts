import { Router } from "express";

import {
  createCustomerViewingFeedback,
} from "../controllers/customerFeedbackController";

import {
  requireAuth,
  requireCustomer,
} from "../middleware/authMiddleware";

const router = Router();

router.post(
  "/viewings/:viewingId",
  requireAuth,
  requireCustomer,
  createCustomerViewingFeedback
);

export default router;
