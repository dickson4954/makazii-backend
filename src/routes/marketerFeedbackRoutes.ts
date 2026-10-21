import { Router } from "express";

import {
  requireAuth,
  requireMarketer,
  requireActiveMarketer,
} from "../middleware/authMiddleware";

import {
  getMarketerFeedback,
} from "../controllers/marketerFeedbackController";

const router = Router();

router.use(requireAuth);
router.use(requireMarketer);
router.use(requireActiveMarketer);

router.get("/", getMarketerFeedback);

export default router;
