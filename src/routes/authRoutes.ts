import { Router } from "express";

import {
  customerSignup,
  landlordSignup,
  landlordLogin,
  landlordApplicationStatusController,
  customerLogin,
  verifyCustomerEmailController,
  resendCustomerEmailVerificationController,
  adminLogin,
  marketerLogin,
  forgotPasswordController,
  resetPasswordController,
  me,
  updateProfileController,
  changePasswordController,
} from "../controllers/authController";

import {
  requireAuth,
  requireRole,
} from "../middleware/authMiddleware";

import { landlordIdUpload } from "../middleware/uploadMiddleware";

import {
  createProfileChangeRequestController,
  getMyProfileChangeRequestsController,
} from "../controllers/marketerProfileChangeController";

const router = Router();

/**
 * =========================================================
 * PUBLIC AUTHENTICATION ROUTES
 * =========================================================
 */

/**
 * CUSTOMER
 *
 * Customers can create their own accounts.
 */
router.post(
  "/customer/signup",
  customerSignup
);

/**
 * LANDLORD
 *
 * Landlords may register publicly. New applications and
 * identity verification start pending review.
 */
router.post(
  "/landlord/signup",
  landlordIdUpload.fields([
    { name: "idFront", maxCount: 1 },
    { name: "idBack", maxCount: 1 },
  ]),
  landlordSignup
);

router.post(
  "/landlord/login",
  landlordLogin
);


router.post(
  "/customer/login",
  customerLogin
);

router.post(
  "/customer/verify-email",
  verifyCustomerEmailController
);

router.post(
  "/customer/resend-verification",
  resendCustomerEmailVerificationController
);

/**
 * ADMIN
 *
 * Admin accounts are NOT publicly registered.
 * They can only log in with an account that already
 * exists and has the ADMIN role.
 */
router.post(
  "/admin/login",
  adminLogin
);

/**
 * MARKETER
 *
 * Marketers are NOT publicly registered.
 * Their accounts will be created by authorized
 * MAKAZII management.
 */
router.post(
  "/marketer/login",
  marketerLogin
);

/**
 * =========================================================
 * PASSWORD RECOVERY
 * =========================================================
 */

/**
 * Request password reset.
 *
 * POST /api/auth/forgot-password
 */
router.post(
  "/forgot-password",
  forgotPasswordController
);

/**
 * Reset password using a valid reset token.
 *
 * POST /api/auth/reset-password
 */
router.post(
  "/reset-password",
  resetPasswordController
);

/**
 * =========================================================
 * PROTECTED AUTHENTICATION ROUTES
 * =========================================================
 */

/**
 * Get the currently authenticated user.
 *
 * GET /api/auth/me
 *
 * Requires:
 * Authorization: Bearer <token>
 */
router.get(
  "/landlord/application-status",
  requireAuth,
  requireRole("LANDLORD"),
  landlordApplicationStatusController
);

router.get(
  "/me",
  requireAuth,
  me
);

/**
 * Update the currently authenticated user's profile.
 *
 * PATCH /api/auth/profile
 *
 * Requires:
 * Authorization: Bearer <token>
 */
router.patch(
  "/profile",
  requireAuth,
  updateProfileController
);

/**
 * =========================================================
 * MARKETER PROFILE CHANGE REQUESTS
 * =========================================================
 */

/**
 * POST /api/auth/profile/change-request
 *
 * Marketers submit first-name, last-name, email and/or
 * phone changes for administrator approval.
 */
router.post(
  "/profile/change-request",
  requireAuth,
  createProfileChangeRequestController
);

/**
 * GET /api/auth/profile/change-requests
 *
 * Marketers can view their own request history.
 */
router.get(
  "/profile/change-requests",
  requireAuth,
  getMyProfileChangeRequestsController
);

/**
 * Change the currently authenticated user's password.
 *
 * PATCH /api/auth/change-password
 *
 * Requires:
 * Authorization: Bearer <token>
 */
router.patch(
  "/change-password",
  requireAuth,
  changePasswordController
);

export default router;
