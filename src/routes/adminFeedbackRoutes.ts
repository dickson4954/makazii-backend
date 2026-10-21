import { Router } from "express";

import {
  getAdminFeedback,
} from "../controllers/adminFeedbackController";

import {
  requireAuth,
  requireAdmin,
} from "../middleware/authMiddleware";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireAdmin,
  getAdminFeedback,
);

export default router;
