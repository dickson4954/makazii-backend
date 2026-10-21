import { Router } from "express";
import {
  getCustomers,
  getCustomer,
  updateCustomerStatus,
  getCustomerStatusHistory,
} from "../controllers/userController";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get("/", getCustomers);
router.get("/:id/status-history", getCustomerStatusHistory);
router.get("/:id", getCustomer);
router.patch("/:id/status", updateCustomerStatus);

export default router;
