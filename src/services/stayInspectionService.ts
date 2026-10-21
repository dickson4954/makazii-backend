import {
  NotificationType,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  StayInspectionStatus,
} from "@prisma/client";

import prisma from "../config/prisma";

function generatePaymentReference(prefix = "INSP") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

export async function createStayInspection(
  propertyId: string,
  renterId: string,
  requestedDate?: Date,
  preferredTime?: string,
  notes?: string
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      title: true,
      purpose: true,
      status: true,
      available: true,
      verified: true,
      viewingFee: true,
      marketerId: true,
    },
  });

  if (!property) {
    throw new Error("Property not found");
  }

  if (property.purpose !== "SHORT_STAY") {
    throw new Error(
      "Inspection requests are only available for short-stay properties"
    );
  }

  if (property.status !== "ACTIVE") {
    throw new Error(
      "This property is not currently active"
    );
  }

  if (!property.available) {
    throw new Error(
      "This property is currently unavailable"
    );
  }

  if (!property.verified) {
    throw new Error(
      "This property is not currently verified"
    );
  }

  if (
    property.viewingFee === null ||
    property.viewingFee === undefined ||
    property.viewingFee <= 0
  ) {
    throw new Error("Invalid inspection fee");
  }

  const existing = await prisma.stayInspection.findFirst({
    where: {
      propertyId,
      renterId,
      status: {
        in: [
          StayInspectionStatus.PENDING_PAYMENT,
          StayInspectionStatus.PAID,
          StayInspectionStatus.AWAITING_ASSIGNMENT,
          StayInspectionStatus.ASSIGNED,
          StayInspectionStatus.CONFIRMED,
        ],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existing) {
    return existing;
  }

  const inspection = await prisma.stayInspection.create({
    data: {
      propertyId,
      renterId,
      requestedDate: requestedDate ?? null,
      preferredTime: preferredTime?.trim() || null,
      notes: notes?.trim() || null,
      status: StayInspectionStatus.PENDING_PAYMENT,
    },
  });

  await prisma.notification.create({
    data: {
      userId: renterId,
      type: NotificationType.INSPECTION_REQUESTED,
      title: "Inspection requested",
      message:
        `Your inspection request for "${property.title}" ` +
        "has been created. Complete the inspection payment to continue.",
      entityType: "STAY_INSPECTION",
      entityId: inspection.id,
    },
  });

  return inspection;
}

export async function createStayInspectionPayment(
  inspectionId: string,
  renterId: string,
  method: PaymentMethod
) {
  const inspection = await prisma.stayInspection.findUnique({
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
          status: true,
          available: true,
          verified: true,
          viewingFee: true,
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
    StayInspectionStatus.PENDING_PAYMENT
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

  const existingPayment =
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

  if (existingPayment) {
    return existingPayment;
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
      reference: generatePaymentReference(),
      status: PaymentStatus.PENDING,
      metadata: {
        type: "STAY_INSPECTION_FEE",
        propertyId: inspection.property.id,
        propertyTitle: inspection.property.title,
      },
    },
  });
}

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
      StayInspectionStatus.PENDING_PAYMENT
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
        status: StayInspectionStatus.PAID,
      },
    });

    await tx.notification.create({
      data: {
        userId: payment.stayInspection.renterId,
        type: NotificationType.INSPECTION_PAID,
        title: "Inspection fee paid",
        message:
          `Your inspection fee for "${payment.stayInspection.property.title}" ` +
          "has been received. Your request is awaiting MAKAZII admin approval.",
        entityType: "STAY_INSPECTION",
        entityId: payment.stayInspection.id,
      },
    });

    const sourceMarketer = payment.stayInspection.property.marketerId
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
      sourceMarketer.user.accountStatus === "ACTIVE" &&
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
            "The inspection is awaiting admin approval.",
          entityType: "STAY_INSPECTION",
          entityId: payment.stayInspection.id,
        },
      });
    }

    return updatedPayment;
  });
}
