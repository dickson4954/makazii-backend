import { Router } from "express";

import {
  getLandlordAccount,
  updateLandlordQuestionnaire,
} from "../controllers/landlordAccountController";
import {
requireAuth,
requireRole,
} from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth, requireRole("LANDLORD"));

router.get("/", getLandlordAccount);
router.patch("/questionnaire", updateLandlordQuestionnaire);

export default router;
