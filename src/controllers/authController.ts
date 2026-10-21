import type { Request, Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

import {
  signupCustomer,
  signupLandlord,
  loginLandlord,
  loginCustomer,
  verifyCustomerEmail,
  resendCustomerEmailVerification,
  loginAdmin,
  loginMarketer,
  forgotPassword,
  resetPassword,
  getLandlordApplicationStatus,
  getCurrentUser,
  updateProfile,
  changePassword,
} from "../services/authService";

import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * CUSTOMER SIGNUP
 *
 * POST /api/auth/customer/signup
 */
export async function customerSignup(
  req: Request,
  res: Response
) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
    } = req.body;

    const result = await signupCustomer({
      firstName,
      lastName,
      email,
      phone,
      password,
    });

    return res.status(201).json({
      success: true,
      message: "Customer account created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Customer signup error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create customer account";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * CUSTOMER LOGIN
 *
 * POST /api/auth/customer/login
 */
export async function verifyCustomerEmailController(
  req: Request,
  res: Response
) {
  try {
    const { email, code } = req.body;

    const result = await verifyCustomerEmail({
      email,
      code,
    });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: result,
    });
  } catch (error) {
    console.error(
      "Customer email verification error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to verify email";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

export async function resendCustomerEmailVerificationController(
  req: Request,
  res: Response
) {
  try {
    const { email } = req.body;

    const result =
      await resendCustomerEmailVerification(email);

    return res.status(200).json({
      success: true,
      message:
        "A new verification code has been generated",
      data: result,
    });
  } catch (error) {
    console.error(
      "Customer verification resend error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to resend verification code";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}


/**
 * LANDLORD SIGNUP
 *
 * POST /api/auth/landlord/signup
 *
 * Accepts multipart/form-data with idFront and idBack.
 * Identity documents are moved into private storage and
 * are never exposed through public/static URLs.
 */
export async function landlordSignup(
  req: Request,
  res: Response
) {
  const uploaded = req.files as
    | {
        idFront?: Express.Multer.File[];
        idBack?: Express.Multer.File[];
      }
    | undefined;

  const front = uploaded?.idFront?.[0];
  const back = uploaded?.idBack?.[0];

  let privateDirectory: string | null = null;

  async function removeTemporaryFile(
    file: Express.Multer.File | undefined
  ) {
    if (!file?.path) return;

    try {
      await fs.unlink(file.path);
    } catch {
      // The file may already have been moved.
    }
  }

  try {
    if (!front || !back) {
      return res.status(400).json({
        success: false,
        message: "Both front and back images of your national ID are required.",
      });
    }

    const applicationId = randomBytes(16).toString("hex");

    privateDirectory = path.resolve(
      process.cwd(),
      "storage",
      "private",
      "landlord-ids",
      applicationId
    );

    await fs.mkdir(privateDirectory, { recursive: true });

    function extensionFor(file: Express.Multer.File) {
      switch (file.mimetype) {
        case "image/png":
          return ".png";
        case "image/webp":
          return ".webp";
        case "image/jpeg":
          return ".jpg";
        default:
          throw new Error("Unsupported identity document image type.");
      }
    }

    const frontExtension = extensionFor(front);
    const backExtension = extensionFor(back);

    await fs.rename(
      front.path,
      path.join(privateDirectory, `front${frontExtension}`)
    );

    await fs.rename(
      back.path,
      path.join(privateDirectory, `back${backExtension}`)
    );

    let questionnaire = req.body?.questionnaire;

    if (typeof questionnaire === "string") {
      questionnaire = JSON.parse(questionnaire);
    }

    const result = await signupLandlord({
      firstName: req.body?.firstName,
      lastName: req.body?.lastName,
      email: req.body?.email,
      phone: req.body?.phone,
      password: req.body?.password,
      nationalIdNumber: req.body?.nationalIdNumber,
      questionnaire,
      idFrontReference:
        `private://landlord-ids/${applicationId}/front${frontExtension}`,
      idBackReference:
        `private://landlord-ids/${applicationId}/back${backExtension}`,
    });

    return res.status(201).json({
      success: true,
      message:
        "Landlord account created. Your application and identity documents are pending review.",
      data: result,
    });
  } catch (error) {
    // If registration fails, remove the private ID files.
    if (privateDirectory) {
      try {
        await fs.rm(privateDirectory, {
          recursive: true,
          force: true,
        });
      } catch {
        console.error("Could not clean up private landlord ID files.");
      }
    }

    console.error("Landlord signup error:", error);

    const message =
      error instanceof SyntaxError
        ? "The questionnaire must contain valid JSON."
        : error instanceof Error
          ? error.message
          : "Unable to create landlord account.";

    return res.status(400).json({
      success: false,
      message,
    });
  } finally {
    await removeTemporaryFile(front);
    await removeTemporaryFile(back);
  }
}

/**
 * LANDLORD LOGIN
 *
 * POST /api/auth/landlord/login
 *
 * Pending review does not prevent login.
 */
export async function landlordLogin(
  req: Request,
  res: Response
) {
  try {
    const { emailOrPhone, password } = req.body ?? {};

    const result = await loginLandlord({
      emailOrPhone,
      password,
    });

    return res.status(200).json({
      success: true,
      message: "Landlord login successful",
      data: result,
    });
  } catch (error) {
    console.error("Landlord login error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to log in.";

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

export async function customerLogin(
  req: Request,
  res: Response
) {
  try {
    const {
      emailOrPhone,
      password,
    } = req.body;

    const result = await loginCustomer({
      emailOrPhone,
      password,
    });

    return res.status(200).json({
      success: true,
      message: "Customer login successful",
      data: result,
    });
  } catch (error) {
    console.error("Customer login error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to log in";

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

/**
 * ADMIN LOGIN
 *
 * POST /api/auth/admin/login
 *
 * There is intentionally NO public admin signup.
 */
export async function adminLogin(
  req: Request,
  res: Response
) {
  try {
    const {
      emailOrPhone,
      password,
    } = req.body;

    const result = await loginAdmin({
      emailOrPhone,
      password,
    });

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: result,
    });
  } catch (error) {
    console.error("Admin login error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to log in";

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

/**
 * MARKETER LOGIN
 *
 * POST /api/auth/marketer/login
 *
 * Marketers do NOT publicly register.
 * Their accounts will be created by authorized
 * MAKAZII management.
 */
export async function marketerLogin(
  req: Request,
  res: Response
) {
  try {
    const {
      emailOrPhone,
      password,
    } = req.body;

    const result = await loginMarketer({
      emailOrPhone,
      password,
    });

    return res.status(200).json({
      success: true,
      message: "Marketer login successful",
      data: result,
    });
  } catch (error) {
    console.error("Marketer login error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to log in";

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

/**
 * FORGOT PASSWORD
 *
 * POST /api/auth/forgot-password
 *
 * Body:
 * {
 *   "email": "customer@example.com"
 * }
 */
export async function forgotPasswordController(
  req: Request,
  res: Response
) {
  try {
    const { email } = req.body;

    const result = await forgotPassword(email);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to process password recovery";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * RESET PASSWORD
 *
 * POST /api/auth/reset-password
 *
 * Body:
 * {
 *   "token": "...",
 *   "newPassword": "..."
 * }
 */
export async function resetPasswordController(
  req: Request,
  res: Response
) {
  try {
    const {
      token,
      newPassword,
    } = req.body;

    const result = await resetPassword(
      token,
      newPassword
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to reset password";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * GET LANDLORD APPLICATION STATUS
 * GET /api/auth/landlord/application-status
 */
export async function landlordApplicationStatusController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const data = await getLandlordApplicationStatus(
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unable to retrieve landlord application status";

    const statusCode = message.includes("not found") ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
}

/**
 * GET CURRENT USER
 *
 * GET /api/auth/me
 *
 * Requires authentication middleware.
 *
 * The middleware will place the authenticated
 * user's ID on req.user.
 */
export async function me(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = await getCurrentUser(
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "Get current user error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to retrieve account";

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

/**
 * UPDATE PROFILE
 *
 * PATCH /api/auth/profile
 *
 * Requires authentication.
 */
export async function updateProfileController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = await updateProfile(
      req.user.userId,
      {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: result,
    });
  } catch (error) {
    console.error(
      "Update profile error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to update profile";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * CHANGE PASSWORD
 *
 * PATCH /api/auth/change-password
 *
 * Requires authentication.
 */
export async function changePasswordController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      currentPassword,
      newPassword,
    } = req.body;

    const result = await changePassword(
      req.user.userId,
      {
        currentPassword,
        newPassword,
      }
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Change password error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to change password";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}
