import { Router } from "express";

import {
  getCustomerPayment,
  initiateViewingPayment,
  initiateStayInspectionPayment,
  fakeConfirmViewingPayment,
  testConfirmPayment,
} from "../controllers/paymentController";

import {
  requireAdmin,
  requireAuth,
  requireCustomer,
} from "../middleware/authMiddleware";

const router = Router();

/**
 * CUSTOMER → INITIATE VIEWING PAYMENT
 *
 * POST /api/payments/viewings/:viewingId
 *
 * Creates a PENDING payment.
 *
 * The fake confirmation endpoint below is used during development
 * to simulate successful M-Pesa payment.
 */
router.post(
  "/viewings/:viewingId",
  requireAuth,
  requireCustomer,
  initiateViewingPayment
);

/**
 * CUSTOMER → FAKE M-PESA VIEWING PAYMENT CONFIRMATION
 *
 * POST /api/payments/viewings/:viewingId/fake-confirm
 *
 * DEVELOPMENT / TESTING ONLY.
 *
 * This simulates successful M-Pesa payment.
 *
 * It changes:
 *
 * Payment:
 *   PENDING → SUCCESS
 *
 * Viewing:
 *   PENDING_PAYMENT → PAID
 *
 * It DOES NOT:
 *   - approve the viewing
 *   - assign a marketer
 *   - release marketer contact
 */
router.post(
  "/viewings/:viewingId/fake-confirm",
  requireAuth,
  requireCustomer,
  fakeConfirmViewingPayment
);

/**
 * CUSTOMER → INITIATE SHORT-STAY INSPECTION PAYMENT
 *
 * POST /api/payments/inspections/:inspectionId
 *
 * Creates a PENDING payment.
 */
router.post(
  "/inspections/:inspectionId",
  requireAuth,
  requireCustomer,
  initiateStayInspectionPayment
);

/**
 * CUSTOMER → VIEW OWN PAYMENT
 *
 * GET /api/payments/:paymentId
 */
router.get(
  "/:paymentId",
  requireAuth,
  requireCustomer,
  getCustomerPayment
);

/**
 * ADMIN → LOCAL PAYMENT CONFIRMATION
 *
 * POST /api/payments/:paymentId/test-confirm
 *
 * Development/testing only.
 *
 * This remains available for backend/admin testing.
 */
router.post(
  "/:paymentId/test-confirm",
  requireAuth,
  requireAdmin,
  testConfirmPayment
);

export default router;
