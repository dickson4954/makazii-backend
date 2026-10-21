import type { Response } from "express";

import {
  NotificationType,
  StayInspectionStatus,
} from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * Get a required route parameter.
 */
function getInspectionId(
  req: AuthenticatedRequest
): string | null {
  const value = req.params.inspectionId;

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    return null;
  }

  return value.trim();
}

/**
 * GET /api/admin/stay-inspections
 *
 * Admin gets the complete operational inspection list.
 */
export async function getAdminStayInspections(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : undefined;

    const inspections =
      await prisma.stayInspection.findMany({
        where: status
          ? {
              status: status as StayInspectionStatus,
            }
          : undefined,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          requestedDate: true,
          preferredTime: true,
          notes: true,
          status: true,
          assignedAt: true,
          confirmedAt: true,
          completedAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,

          renter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
            },
          },

          property: {
            select: {
              id: true,
              title: true,
              purpose: true,
              viewingFee: true,
              status: true,
              available: true,
              verified: true,

              createdBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  role: true,
                  isActive: true,
                  accountStatus: true,
                },
              },

              marketer: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true,
                      role: true,
                      isActive: true,
                      accountStatus: true,
                    },
                  },
                },
              },
            },
          },

          assignedMarketer: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  role: true,
                  isActive: true,
                  accountStatus: true,
                },
              },
            },
          },

          payments: {
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
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    return res.status(200).json({
      success: true,
      data: {
        inspections,
      },
    });
  } catch (error) {
    console.error(
      "getAdminStayInspections error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load stay inspections",
    });
  }
}

/**
 * GET /api/admin/stay-inspections/:inspectionId
 *
 * Admin gets one complete inspection.
 */
export async function getAdminStayInspection(
  req: AuthenticatedRequest,
  res: Response
) {
  const inspectionId = getInspectionId(req);

  if (!inspectionId) {
    return res.status(400).json({
      success: false,
      message: "Inspection ID is required",
    });
  }

  try {
    const inspection =
      await prisma.stayInspection.findUnique({
        where: {
          id: inspectionId,
        },
        select: {
          id: true,
          requestedDate: true,
          preferredTime: true,
          notes: true,
          status: true,
          assignedAt: true,
          confirmedAt: true,
          completedAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,

          renter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
            },
          },

          property: {
            select: {
              id: true,
              title: true,
              purpose: true,
              viewingFee: true,
              status: true,
              available: true,
              verified: true,

              createdBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  role: true,
                  isActive: true,
                  accountStatus: true,
                },
              },

              marketer: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true,
                      role: true,
                      isActive: true,
                      accountStatus: true,
                    },
                  },
                },
              },
            },
          },

          assignedMarketer: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  role: true,
                  isActive: true,
                  accountStatus: true,
                },
              },
            },
          },

          payments: {
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
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: "Stay inspection not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        inspection,
      },
    });
  } catch (error) {
    console.error(
      "getAdminStayInspection error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load stay inspection",
    });
  }
}

/**
 * POST /api/admin/stay-inspections/:inspectionId/approve
 *
 * Approve a PAID inspection and release the correct
 * two-way contact relationship.
 *
 * RULES:
 *
 * 1. MARKETER-created property:
 *    Customer <-> source marketer.
 *
 * 2. ADMIN-created property:
 *    Customer <-> admin who created/uploaded the property.
 *
 * 3. If an admin created the property, the property's
 *    source marketer does NOT receive the inspection.
 *
 * 4. Contact is released only after admin approval.
 */
export async function approveAdminStayInspection(
  req: AuthenticatedRequest,
  res: Response
) {
  const inspectionId = getInspectionId(req);

  if (!inspectionId) {
    return res.status(400).json({
      success: false,
      message: "Inspection ID is required",
    });
  }

  const adminUserId = req.user?.userId;

  if (!adminUserId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const inspection =
          await tx.stayInspection.findUnique({
            where: {
              id: inspectionId,
            },
            select: {
              id: true,
              status: true,
              renterId: true,

              renter: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  isActive: true,
                  accountStatus: true,
                  role: true,
                },
              },

              property: {
                select: {
                  id: true,
                  title: true,
                  marketerId: true,

                  createdBy: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      phone: true,
                      role: true,
                      isActive: true,
                      accountStatus: true,
                    },
                  },
                },
              },
            },
          });

        if (!inspection) {
          throw new Error(
            "Stay inspection not found"
          );
        }

        if (
          inspection.status !==
          StayInspectionStatus.PAID
        ) {
          if (
            inspection.status ===
              StayInspectionStatus.ASSIGNED ||
            inspection.status ===
              StayInspectionStatus.CONFIRMED ||
            inspection.status ===
              StayInspectionStatus.COMPLETED
          ) {
            return {
              inspection,
              alreadyAssigned: true,
              handlerType:
                inspection.property.createdBy.role ===
                "MARKETER"
                  ? "MARKETER"
                  : "ADMIN",
              handler: null,
            };
          }

          throw new Error(
            `Only PAID inspections can be approved. Current status: ${inspection.status}`
          );
        }

        if (
          !inspection.renter.isActive ||
          inspection.renter.accountStatus !==
            "ACTIVE"
        ) {
          throw new Error(
            "The customer account is not active"
          );
        }

        const creator =
          inspection.property.createdBy;

        /*
         * ------------------------------------------------------
         * CASE 1: MARKETER CREATED THE PROPERTY
         * ------------------------------------------------------
         *
         * The source marketer becomes the inspection handler.
         */
        if (creator.role === "MARKETER") {
          if (!inspection.property.marketerId) {
            throw new Error(
              "This marketer-created property has no source marketer"
            );
          }

          const marketer =
            await tx.marketer.findUnique({
              where: {
                id: inspection.property.marketerId,
              },
              select: {
                id: true,
                userId: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    role: true,
                    isActive: true,
                    accountStatus: true,
                  },
                },
              },
            });

          if (!marketer) {
            throw new Error(
              "Source marketer not found"
            );
          }

          if (
            marketer.user.role !== "MARKETER" ||
            !marketer.user.isActive ||
            marketer.user.accountStatus !==
              "ACTIVE"
          ) {
            throw new Error(
              "The source marketer is not active"
            );
          }

          const updatedInspection =
            await tx.stayInspection.update({
              where: {
                id: inspection.id,
              },
              data: {
                status:
                  StayInspectionStatus.ASSIGNED,
                assignedMarketerId:
                  marketer.id,
                assignedAt: new Date(),
              },
              select: {
                id: true,
                status: true,
                assignedAt: true,
                assignedMarketer: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                      },
                    },
                  },
                },
              },
            });

          /*
           * Customer now gets the marketer's contact.
           */
          await tx.notification.create({
            data: {
              userId: inspection.renter.id,
              type:
                NotificationType.INSPECTION_ASSIGNED,
              title: "Inspection approved",
              message:
                `Your inspection for "${inspection.property.title}" has been approved. ` +
                `Your property representative is ${marketer.user.firstName} ${marketer.user.lastName}. ` +
                `Phone: ${marketer.user.phone ?? "Not provided"}. ` +
                `Email: ${marketer.user.email}.`,
              entityType: "STAY_INSPECTION",
              entityId: inspection.id,
            },
          });

          /*
           * Marketer now gets the customer's contact.
           */
          await tx.notification.create({
            data: {
              userId: marketer.userId,
              type:
                NotificationType.INSPECTION_ASSIGNED,
              title: "Inspection assigned",
              message:
                `A paid inspection for "${inspection.property.title}" has been approved and assigned to you. ` +
                `Customer: ${inspection.renter.firstName} ${inspection.renter.lastName}. ` +
                `Phone: ${inspection.renter.phone ?? "Not provided"}. ` +
                `Email: ${inspection.renter.email}.`,
              entityType: "STAY_INSPECTION",
              entityId: inspection.id,
            },
          });

          return {
            inspection: updatedInspection,
            alreadyAssigned: false,
            handlerType: "MARKETER" as const,
            handler: {
              id: marketer.id,
              userId: marketer.user.id,
              firstName:
                marketer.user.firstName,
              lastName:
                marketer.user.lastName,
              phone:
                marketer.user.phone,
              email:
                marketer.user.email,
            },
          };
        }

        /*
         * ------------------------------------------------------
         * CASE 2: ADMIN CREATED THE PROPERTY
         * ------------------------------------------------------
         *
         * The admin who actually created the property becomes
         * the operational handler.
         *
         * IMPORTANT:
         * property.marketerId is intentionally ignored here.
         */
        if (creator.role === "ADMIN") {
          if (
            !creator.isActive ||
            creator.accountStatus !== "ACTIVE"
          ) {
            throw new Error(
              "The property-creating admin account is not active"
            );
          }

          const updatedInspection =
            await tx.stayInspection.update({
              where: {
                id: inspection.id,
              },
              data: {
                status:
                  StayInspectionStatus.ASSIGNED,
                assignedMarketerId: null,
                assignedAt: new Date(),
              },
              select: {
                id: true,
                status: true,
                assignedAt: true,
                assignedMarketer: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                      },
                    },
                  },
                },
              },
            });

          /*
           * Customer gets the contact of the admin who
           * actually uploaded/created the property.
           */
          await tx.notification.create({
            data: {
              userId: inspection.renter.id,
              type:
                NotificationType.INSPECTION_ASSIGNED,
              title: "Inspection approved",
              message:
                `Your inspection for "${inspection.property.title}" has been approved. ` +
                `Your property representative is ${creator.firstName} ${creator.lastName}. ` +
                `Phone: ${creator.phone ?? "Not provided"}. ` +
                `Email: ${creator.email}.`,
              entityType: "STAY_INSPECTION",
              entityId: inspection.id,
            },
          });

          /*
           * The admin who created the property gets the
           * customer's contact.
           */
          await tx.notification.create({
            data: {
              userId: creator.id,
              type:
                NotificationType.INSPECTION_ASSIGNED,
              title: "Inspection assigned to you",
              message:
                `A paid inspection for "${inspection.property.title}" has been approved. ` +
                `Customer: ${inspection.renter.firstName} ${inspection.renter.lastName}. ` +
                `Phone: ${inspection.renter.phone ?? "Not provided"}. ` +
                `Email: ${inspection.renter.email}.`,
              entityType: "STAY_INSPECTION",
              entityId: inspection.id,
            },
          });

          return {
            inspection: updatedInspection,
            alreadyAssigned: false,
            handlerType: "ADMIN" as const,
            handler: {
              id: creator.id,
              userId: creator.id,
              firstName: creator.firstName,
              lastName: creator.lastName,
              phone: creator.phone,
              email: creator.email,
            },
          };
        }

        throw new Error(
          "Unsupported property creator role"
        );
      }
    );

    return res.status(200).json({
      success: true,
      message: result.alreadyAssigned
        ? "Inspection is already approved and assigned"
        : result.handlerType === "MARKETER"
          ? "Inspection approved and assigned to the source marketer"
          : "Inspection approved and assigned to the property-creating admin",
      data: {
        inspection: result.inspection,
        handlerType: result.handlerType,
        handler: result.handler,
        alreadyAssigned:
          result.alreadyAssigned,
      },
    });
  } catch (error) {
    console.error(
      "approveAdminStayInspection error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to approve stay inspection";

    if (
      message ===
        "Stay inspection not found" ||
      message ===
        "Source marketer not found"
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message.startsWith(
        "Only PAID inspections can be approved"
      )
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
