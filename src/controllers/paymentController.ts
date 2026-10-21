import type { Response } from "express";

import {
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

import {
  confirmStayInspectionPayment,
  confirmViewingPayment,
  createStayInspectionPayment,
  createViewingPayment,
} from "../services/paymentService";

/**
 * POST /api/payments/viewings/:viewingId
 *
 * Customer initiates payment for a long-stay viewing.
 *
 * This creates a PENDING payment only.
 */
export async function initiateViewingPayment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const renterId = req.user.userId;
    const viewingId =
      String(req.params.viewingId || "").trim();

    if (!viewingId) {
      return res.status(400).json({
        success: false,
        message: "Viewing ID is required",
      });
    }

    const { method } = req.body;

    if (
      typeof method !== "string" ||
      !Object.values(PaymentMethod).includes(
        method as PaymentMethod
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment method must be one of: MPESA, CARD, BANK, CASH",
      });
    }

    if (method === PaymentMethod.CASH) {
      return res.status(400).json({
        success: false,
        message:
          "Cash payments cannot be initiated through the customer payment endpoint",
      });
    }

    const payment = await createViewingPayment(
      viewingId,
      renterId,
      method as PaymentMethod
    );

    return res.status(201).json({
      success: true,
      message:
        "Payment initiated. Complete the payment to continue.",
      data: {
        payment: {
          id: payment.id,
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          provider: payment.provider,
          status: payment.status,
          createdAt: payment.createdAt,
        },
      },
    });
  } catch (error) {
    console.error(
      "initiateViewingPayment error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to initiate payment";

    if (message === "Viewing request not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "You are not allowed to pay for this viewing"
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "This viewing is not currently awaiting payment"
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * POST /api/payments/inspections/:inspectionId
 *
 * Customer initiates payment for a short-stay inspection.
 *
 * This creates a PENDING payment only.
 */
export async function initiateStayInspectionPayment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const renterId = req.user.userId;
    const inspectionId =
      String(req.params.inspectionId || "").trim();

    if (!inspectionId) {
      return res.status(400).json({
        success: false,
        message: "Inspection ID is required",
      });
    }

    const { method } = req.body;

    if (
      typeof method !== "string" ||
      !Object.values(PaymentMethod).includes(
        method as PaymentMethod
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment method must be one of: MPESA, CARD, BANK, CASH",
      });
    }

    if (method === PaymentMethod.CASH) {
      return res.status(400).json({
        success: false,
        message:
          "Cash payments cannot be initiated through the customer payment endpoint",
      });
    }

    const payment =
      await createStayInspectionPayment(
        inspectionId,
        renterId,
        method as PaymentMethod
      );

    return res.status(201).json({
      success: true,
      message:
        "Inspection payment initiated. Complete the payment to continue.",
      data: {
        payment: {
          id: payment.id,
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          provider: payment.provider,
          status: payment.status,
          createdAt: payment.createdAt,
        },
      },
    });
  } catch (error) {
    console.error(
      "initiateStayInspectionPayment error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to initiate inspection payment";

    if (
      message === "Inspection request not found"
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "You are not allowed to pay for this inspection"
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "This inspection is not currently awaiting payment"
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * GET /api/payments/:paymentId
 *
 * Customer checks their own payment.
 *
 * We deliberately do not allow a customer to query
 * another customer's payment.
 */
export async function getCustomerPayment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const renterId = req.user.userId;
    const paymentId =
      String(req.params.paymentId || "").trim();

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        provider: true,
        reference: true,
        providerReference: true,
        status: true,
        paidAt: true,
        failedAt: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,

        viewingRequest: {
          select: {
            id: true,
            status: true,
            property: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },

        stayInspection: {
          select: {
            id: true,
            status: true,
            property: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },

        stayBooking: {
          select: {
            id: true,
            status: true,
            property: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const ownership = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId: renterId,
      },
      select: {
        id: true,
      },
    });

    if (!ownership) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to view this payment",
      });
    }

    return res.json({
      success: true,
      data: {
        payment,
      },
    });
  } catch (error) {
    console.error(
      "getCustomerPayment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment",
    });
  }
}

/**
 * POST /api/payments/:paymentId/test-confirm
 *
 * ADMIN-ONLY LOCAL DEVELOPMENT ENDPOINT.
 *
 * This simulates a payment provider confirming SUCCESS.
 *
 * Supported:
 * - long-stay viewing payments
 * - short-stay inspection payments
 *
 * Short-stay booking payment confirmation will be added
 * when the booking payment flow is implemented.
 */

/**
 * CUSTOMER → FAKE CONFIRM VIEWING PAYMENT
 *
 * DEVELOPMENT / TESTING ONLY.
 *
 * This simulates successful M-Pesa confirmation without contacting
 * Safaricom/Daraja.
 *
 * IMPORTANT:
 * - Customer must own the viewing.
 * - Payment must belong to the viewing/customer.
 * - Payment becomes SUCCESS.
 * - Viewing becomes PAID.
 * - Viewing is NOT approved.
 * - Marketer is NOT assigned.
 * - Marketer/customer contact is NOT released.
 *
 * POST /api/payments/viewings/:viewingId/fake-confirm
 */
export async function fakeConfirmViewingPayment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const renterId = req.user.userId;

    const viewingId =
      String(req.params.viewingId || "").trim();

    if (!viewingId) {
      return res.status(400).json({
        success: false,
        message: "Viewing ID is required",
      });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        viewingRequestId: viewingId,
        userId: renterId,
        status: {
          in: [
            PaymentStatus.PENDING,
            PaymentStatus.PROCESSING,
          ],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "No pending payment was found for this viewing",
      });
    }

    const confirmedPayment =
      await confirmViewingPayment(
        payment.id,
        `FAKE-MPESA-${Date.now()}`
      );

    return res.status(200).json({
      success: true,
      message:
        "Fake M-Pesa payment confirmed successfully. Viewing is awaiting admin approval.",
      data: {
        payment: {
          id: confirmedPayment.id,
          reference: confirmedPayment.reference,
          providerReference:
            confirmedPayment.providerReference,
          amount: confirmedPayment.amount,
          currency: confirmedPayment.currency,
          method: confirmedPayment.method,
          status: confirmedPayment.status,
          paidAt: confirmedPayment.paidAt,
        },
        viewing: {
          id: viewingId,
          status: "PAID",
        },
      },
    });
  } catch (error) {
    console.error(
      "fakeConfirmViewingPayment error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Fake payment confirmation failed",
    });
  }
}

export async function testConfirmPayment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const paymentId =
      String(req.params.paymentId || "").trim();

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const { providerReference } = req.body;

    if (
      providerReference !== undefined &&
      providerReference !== null &&
      typeof providerReference !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "providerReference must be a string",
      });
    }

    const paymentTarget =
      await prisma.payment.findUnique({
        where: {
          id: paymentId,
        },
        select: {
          id: true,
          viewingRequestId: true,
          stayInspectionId: true,
          stayBookingId: true,
        },
      });

    if (!paymentTarget) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (paymentTarget.viewingRequestId) {
      const payment =
        await confirmViewingPayment(
          paymentId,
          typeof providerReference === "string"
            ? providerReference
            : undefined
        );

      return res.json({
        success: true,
        message:
          payment.status === PaymentStatus.SUCCESS
            ? "Payment confirmed successfully"
            : "Payment processed",
        data: {
          payment: {
            id: payment.id,
            reference: payment.reference,
            providerReference:
              payment.providerReference,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            paidAt: payment.paidAt,
          },
        },
      });
    }

    if (paymentTarget.stayInspectionId) {
      const payment =
        await confirmStayInspectionPayment(
          paymentId,
          typeof providerReference === "string"
            ? providerReference
            : undefined
        );

      return res.json({
        success: true,
        message:
          payment.status === PaymentStatus.SUCCESS
            ? "Inspection payment confirmed successfully"
            : "Inspection payment processed",
        data: {
          payment: {
            id: payment.id,
            reference: payment.reference,
            providerReference:
              payment.providerReference,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            paidAt: payment.paidAt,
          },
        },
      });
    }

    if (paymentTarget.stayBookingId) {
      return res.status(409).json({
        success: false,
        message:
          "Booking payment confirmation is not implemented yet",
      });
    }

    return res.status(400).json({
      success: false,
      message:
        "Payment is not linked to a supported payment target",
    });
  } catch (error) {
    console.error(
      "testConfirmPayment error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to confirm payment";

    if (message === "Payment not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "Payment is not linked to a viewing request"
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "Payment is not linked to a stay inspection"
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "Only pending or processing payments can be confirmed"
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    return res.status(400).json({
      success: false,
      message,
    });
  }
}
