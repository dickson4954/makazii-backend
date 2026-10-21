import {
  NotificationType,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  ViewingStatus,
} from "@prisma/client";

import prisma from "../config/prisma";

function generatePaymentReference(prefix = "MKZ") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

/**
 * Creates a pending payment for a viewing.
 *
 * IMPORTANT:
 * This function never marks the payment as successful.
 * Success must come from provider confirmation.
 */
export async function createViewingPayment(
  viewingId: string,
  renterId: string,
  method: PaymentMethod
) {
  const viewing = await prisma.viewingRequest.findUnique({
    where: {
      id: viewingId,
    },
    select: {
      id: true,
      renterId: true,
      status: true,
      property: {
        select: {
          id: true,
          title: true,
          viewingFee: true,
          status: true,
          available: true,
          verified: true,
        },
      },
    },
  });

  if (!viewing) {
    throw new Error("Viewing request not found");
  }

  if (viewing.renterId !== renterId) {
    throw new Error("You are not allowed to pay for this viewing");
  }

  if (viewing.status !== ViewingStatus.PENDING_PAYMENT) {
    throw new Error(
      "This viewing is not currently awaiting payment"
    );
  }

  if (viewing.property.status !== "ACTIVE") {
    throw new Error(
      "This property is no longer active and cannot accept a viewing payment"
    );
  }

  if (!viewing.property.available) {
    throw new Error(
      "This property is currently unavailable and cannot accept a viewing payment"
    );
  }

  if (!viewing.property.verified) {
    throw new Error(
      "This property is not currently verified and cannot accept a viewing payment"
    );
  }

  if (
    viewing.property.viewingFee === null ||
    viewing.property.viewingFee === undefined ||
    viewing.property.viewingFee <= 0
  ) {
    throw new Error("Invalid viewing fee");
  }

  const existingPendingPayment =
    await prisma.payment.findFirst({
      where: {
        viewingRequestId: viewing.id,
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

  if (existingPendingPayment) {
    return existingPendingPayment;
  }

  const payment = await prisma.payment.create({
    data: {
      userId: renterId,
      viewingRequestId: viewing.id,
      amount: viewing.property.viewingFee,
      currency: "KES",
      method,
      provider:
        method === PaymentMethod.MPESA
          ? PaymentProvider.MPESA
          : PaymentProvider.INTERNAL,
      reference: generatePaymentReference("VIEW"),
      status: PaymentStatus.PENDING,
      metadata: {
        type: "VIEWING_FEE",
        propertyId: viewing.property.id,
        propertyTitle: viewing.property.title,
      },
    },
  });

  return payment;
}

/**
 * Confirms a payment after the payment provider has reported success.
 *
 * This is the ONLY place in this module that turns a payment into SUCCESS.
 */
export async function confirmViewingPayment(
  paymentId: string,
  providerReference?: string
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        viewingRequest: {
          select: {
            id: true,
            renterId: true,
            status: true,
            property: {
              select: {
                id: true,
                title: true,
                marketerId: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (!payment.viewingRequest) {
      throw new Error(
        "Payment is not linked to a viewing request"
      );
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }

    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.PROCESSING
    ) {
      throw new Error(
        "Only pending or processing payments can be confirmed"
      );
    }

    const now = new Date();

    const updatedPayment =
      await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.SUCCESS,
          paidAt: now,
          providerReference:
            providerReference?.trim() || null,
        },
      });

    await tx.viewingRequest.update({
      where: {
        id: payment.viewingRequest.id,
      },
      data: {
        status: ViewingStatus.PAID,
      },
    });

    await tx.viewingStatusHistory.create({
      data: {
        viewingId: payment.viewingRequest.id,
        status: ViewingStatus.PAID,
        note:
          "Viewing fee payment confirmed successfully. Awaiting admin approval.",
        changedById: payment.userId,
      },
    });

    await tx.notification.create({
      data: {
        userId: payment.viewingRequest.renterId,
        type: NotificationType.VIEWING_PAID,
        title: "Viewing fee paid",
        message:
          `Your viewing fee for "${payment.viewingRequest.property.title}" ` +
          "has been received. Your request is awaiting MAKAZII admin approval.",
        entityType: "VIEWING",
        entityId: payment.viewingRequest.id,
      },
    });

    /*
     * IMPORTANT:
     *
     * The source marketer may be notified that a viewing fee
     * has been paid, but we DO NOT assign the marketer yet
     * and we DO NOT expose customer contact information.
     *
     * The marketer will receive the full viewing/customer
     * information only after admin approval.
     */

    const sourceMarketer = payment.viewingRequest.property.marketerId
      ? await tx.marketer.findUnique({
          where: {
            id: payment.viewingRequest.property.marketerId,
          },
          include: {
            user: {
              select: {
                isActive: true,
              },
            },
          },
        })
      : null;

    if (sourceMarketer?.user.isActive) {
      await tx.notification.create({
        data: {
          userId: sourceMarketer.userId,
          type: NotificationType.VIEWING_PAID,
          title: "Viewing fee received",
          message:
            `A customer has paid the viewing fee for ` +
            `"${payment.viewingRequest.property.title}". ` +
            "The viewing is awaiting admin approval.",
          entityType: "VIEWING",
          entityId: payment.viewingRequest.id,
        },
      });
    }

    return updatedPayment;
  });
}

/**
 * Creates a pending payment for a short-stay inspection.
 *
 * The inspection fee currently uses Property.viewingFee.
 *
 * IMPORTANT:
 * This function never marks the payment as successful.
 * Success must come from provider confirmation.
 */
export async function createStayInspectionPayment(
  inspectionId: string,
  renterId: string,
  method: PaymentMethod
) {
  const inspection =
    await prisma.stayInspection.findUnique({
      where: {
        id: inspectionId,
      },
      select: {
        id: true,
        renterId: true,
        status: true,
        property: {
          select: {
            id: true,
            title: true,
            purpose: true,
            viewingFee: true,
            status: true,
            available: true,
            verified: true,
          },
        },
      },
    });

  if (!inspection) {
    throw new Error("Inspection request not found");
  }

  if (inspection.renterId !== renterId) {
    throw new Error(
      "You are not allowed to pay for this inspection"
    );
  }

  if (
    inspection.status !==
    "PENDING_PAYMENT"
  ) {
    throw new Error(
      "This inspection is not currently awaiting payment"
    );
  }

  if (inspection.property.purpose !== "SHORT_STAY") {
    throw new Error(
      "This property is not a short-stay property"
    );
  }

  if (inspection.property.status !== "ACTIVE") {
    throw new Error(
      "This property is no longer active and cannot accept an inspection payment"
    );
  }

  if (!inspection.property.available) {
    throw new Error(
      "This property is currently unavailable and cannot accept an inspection payment"
    );
  }

  if (!inspection.property.verified) {
    throw new Error(
      "This property is not currently verified and cannot accept an inspection payment"
    );
  }

  if (
    inspection.property.viewingFee === null ||
    inspection.property.viewingFee === undefined ||
    inspection.property.viewingFee <= 0
  ) {
    throw new Error("Invalid inspection fee");
  }

  const existingPendingPayment =
    await prisma.payment.findFirst({
      where: {
        stayInspectionId: inspection.id,
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

  if (existingPendingPayment) {
    return existingPendingPayment;
  }

  return prisma.payment.create({
    data: {
      userId: renterId,
      stayInspectionId: inspection.id,
      amount: inspection.property.viewingFee,
      currency: "KES",
      method,
      provider:
        method === PaymentMethod.MPESA
          ? PaymentProvider.MPESA
          : PaymentProvider.INTERNAL,
      reference: generatePaymentReference("INSP"),
      status: PaymentStatus.PENDING,
      metadata: {
        type: "STAY_INSPECTION_FEE",
        propertyId: inspection.property.id,
        propertyTitle: inspection.property.title,
      },
    },
  });
}

/**
 * Confirms a short-stay inspection payment after
 * the payment provider has reported success.
 *
 * IMPORTANT:
 * Payment confirmation does NOT assign the inspection.
 * It only changes the inspection to PAID.
 *
 * Customer contact details remain private until an
 * admin explicitly approves the paid inspection.
 *
 * A source marketer is notified about payment only when
 * that marketer actually created/uploaded the property.
 * If an admin created the property, the source marketer
 * receives no inspection payment notification.
 */
export async function confirmStayInspectionPayment(
  paymentId: string,
  providerReference?: string
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        stayInspection: {
          select: {
            id: true,
            renterId: true,
            status: true,

            property: {
              select: {
                id: true,
                title: true,
                marketerId: true,

                createdBy: {
                  select: {
                    id: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (!payment.stayInspection) {
      throw new Error(
        "Payment is not linked to a stay inspection"
      );
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }

    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.PROCESSING
    ) {
      throw new Error(
        "Only pending or processing payments can be confirmed"
      );
    }

    if (
      payment.stayInspection.status !==
      "PENDING_PAYMENT"
    ) {
      throw new Error(
        "This inspection is not awaiting payment"
      );
    }

    const now = new Date();

    const updatedPayment =
      await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.SUCCESS,
          paidAt: now,
          providerReference:
            providerReference?.trim() || null,
        },
      });

    await tx.stayInspection.update({
      where: {
        id: payment.stayInspection.id,
      },
      data: {
        status: "PAID",
      },
    });

    /*
     * Customer receives confirmation that payment was
     * successful, but the request still requires admin
     * approval.
     */
    await tx.notification.create({
      data: {
        userId:
          payment.stayInspection.renterId,
        type: NotificationType.INSPECTION_PAID,
        title: "Inspection fee paid",
        message:
          `Your inspection fee for "${payment.stayInspection.property.title}" ` +
          "has been received. Your request is awaiting MAKAZII admin approval.",
        entityType: "STAY_INSPECTION",
        entityId:
          payment.stayInspection.id,
      },
    });

    /*
     * IMPORTANT PRIVACY RULE:
     *
     * Only notify the source marketer if the marketer
     * actually created/uploaded the property.
     *
     * If an ADMIN created the property, the marketerId
     * represents the source marketer only. That marketer
     * must not receive inspection information or customer
     * contact merely because they are attached to the
     * property.
     */
    if (
      payment.stayInspection.property.createdBy.role ===
      "MARKETER"
    ) {
      const sourceMarketer =
        payment.stayInspection.property.marketerId
          ? await tx.marketer.findUnique({
              where: {
                id: payment.stayInspection.property.marketerId,
              },
              include: {
                user: {
                  select: {
                    isActive: true,
                    accountStatus: true,
                    role: true,
                  },
                },
              },
            })
          : null;

      if (
        sourceMarketer?.user.isActive &&
        sourceMarketer.user.accountStatus ===
          "ACTIVE" &&
        sourceMarketer.user.role === "MARKETER"
      ) {
        await tx.notification.create({
          data: {
            userId: sourceMarketer.userId,
            type: NotificationType.INSPECTION_PAID,
            title: "Inspection fee received",
            message:
              `A customer has paid the inspection fee for ` +
              `"${payment.stayInspection.property.title}". ` +
              "The inspection is awaiting admin approval. " +
              "Customer contact details will only be available " +
              "after admin approval.",
            entityType: "STAY_INSPECTION",
            entityId:
              payment.stayInspection.id,
          },
        });
      }
    }

    return updatedPayment;
  });
}
