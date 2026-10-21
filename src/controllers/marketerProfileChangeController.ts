import type { Response } from "express";

import type { AuthenticatedRequest } from "../middleware/authMiddleware";

import {
  createMarketerProfileChangeRequest,
  getMyMarketerProfileChangeRequests,
  getAllMarketerProfileChangeRequests,
  approveMarketerProfileChangeRequest,
  rejectMarketerProfileChangeRequest,
} from "../services/marketerProfileChangeService";

/**
 * POST /api/auth/profile/change-request
 */
export async function createProfileChangeRequestController(
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

    if (req.user.role !== "MARKETER") {
      return res.status(403).json({
        success: false,
        message:
          "Only marketers can submit marketer profile change requests",
      });
    }

    const request =
      await createMarketerProfileChangeRequest(
        req.user.userId,
        {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          phone: req.body.phone,
          reason: req.body.reason,
        }
      );

    return res.status(201).json({
      success: true,
      message:
        "Profile change request submitted successfully. It is pending admin approval.",
      data: request,
    });
  } catch (error) {
    console.error(
      "Create marketer profile change request error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to submit profile change request",
    });
  }
}

/**
 * GET /api/auth/profile/change-requests
 */
export async function getMyProfileChangeRequestsController(
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

    if (req.user.role !== "MARKETER") {
      return res.status(403).json({
        success: false,
        message:
          "Only marketers can access marketer profile change requests",
      });
    }

    const requests =
      await getMyMarketerProfileChangeRequests(
        req.user.userId
      );

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error(
      "Get marketer profile change requests error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to load profile change requests",
    });
  }
}

/**
 * GET /api/admin/marketers/profile-change-requests
 */
export async function getAllProfileChangeRequestsController(
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

    const status =
      typeof req.query.status === "string"
        ? req.query.status
        : undefined;

    const requests =
      await getAllMarketerProfileChangeRequests(
        status
      );

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error(
      "Get all marketer profile change requests error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to load profile change requests",
    });
  }
}

/**
 * PATCH /api/admin/marketers/profile-change-requests/:id/approve
 */
export async function approveProfileChangeRequestController(
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

    const requestId =
      typeof req.params.id === "string"
        ? req.params.id
        : undefined;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Profile change request ID is required",
      });
    }

    const result =
      await approveMarketerProfileChangeRequest(
        requestId,
        req.user.userId
      );

    return res.status(200).json({
      success: true,
      message:
        "Marketer profile change request approved successfully",
      data: result,
    });
  } catch (error) {
    console.error(
      "Approve marketer profile change request error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to approve profile change request",
    });
  }
}

/**
 * PATCH /api/admin/marketers/profile-change-requests/:id/reject
 */
export async function rejectProfileChangeRequestController(
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

    const requestId =
      typeof req.params.id === "string"
        ? req.params.id
        : undefined;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: "Profile change request ID is required",
      });
    }

    const adminNotes =
      typeof req.body.adminNotes === "string"
        ? req.body.adminNotes
        : "";

    const request =
      await rejectMarketerProfileChangeRequest(
        requestId,
        req.user.userId,
        adminNotes
      );

    return res.status(200).json({
      success: true,
      message:
        "Marketer profile change request rejected",
      data: request,
    });
  } catch (error) {
    console.error(
      "Reject marketer profile change request error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to reject profile change request",
    });
  }
}
