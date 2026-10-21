import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

export async function getLandlordPayments(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const landlord = await prisma.landlord.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!landlord) {
      return res.status(404).json({
        success: false,
        message: "Landlord account was not found.",
      });
    }

    const payments = await prisma.payment.findMany({
      where: {
        OR: [
          {
            viewingRequest: {
              is: {
                property: {
                  is: { landlordId: landlord.id },
                },
              },
            },
          },
          {
            stayInspection: {
              is: {
                property: {
                  is: { landlordId: landlord.id },
                },
              },
            },
          },
          {
            stayBooking: {
              is: {
                property: {
                  is: { landlordId: landlord.id },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        provider: true,
        reference: true,
        status: true,
        paidAt: true,
        createdAt: true,
        viewingRequest: {
          select: {
            property: {
              select: {
                id: true,
                title: true,
                purpose: true,
              },
            },
          },
        },
        stayInspection: {
          select: {
            property: {
              select: {
                id: true,
                title: true,
                purpose: true,
              },
            },
          },
        },
        stayBooking: {
          select: {
            property: {
              select: {
                id: true,
                title: true,
                purpose: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const records = payments.map((payment) => {
      const viewingProperty = payment.viewingRequest?.property;
      const inspectionProperty = payment.stayInspection?.property;
      const bookingProperty = payment.stayBooking?.property;

      const property =
        viewingProperty ?? inspectionProperty ?? bookingProperty;

      const type = payment.viewingRequest
        ? "VIEWING"
        : payment.stayInspection
          ? "INSPECTION"
          : "BOOKING";

      return {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        provider: payment.provider,
        reference: payment.reference,
        status: payment.status,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        type,
        property: property
          ? {
              id: property.id,
              title: property.title,
              purpose: property.purpose,
            }
          : null,
      };
    });

    const successful = records.filter(
      (payment) => payment.status === "SUCCESS",
    );

    const pending = records.filter(
      (payment) =>
        payment.status === "PENDING" ||
        payment.status === "PROCESSING",
    );

    return res.status(200).json({
      success: true,
      data: {
        payments: records,
        summary: {
          recordsReturned: records.length,
          successfulCount: successful.length,
          successfulAmount: successful.reduce(
            (total, payment) => total + payment.amount,
            0,
          ),
          pendingCount: pending.length,
          pendingAmount: pending.reduce(
            (total, payment) => total + payment.amount,
            0,
          ),
        },
      },
    });
  } catch (error) {
    console.error("Get landlord payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load landlord payment records.",
    });
  }
}
