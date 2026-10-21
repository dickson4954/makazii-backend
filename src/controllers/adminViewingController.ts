import type { Response } from "express";

import {
  NotificationType,
  ViewingStatus,
} from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * Get a required route parameter.
 */
function getViewingId(
  req: AuthenticatedRequest
): string | null {
  const value = req.params.viewingId;

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    return null;
  }

  return value.trim();
}

/**
 * GET /api/admin/viewings
 *
 * Admin viewing management list.
 *
 * Admin can see the complete operational information,
 * including renter contact and assigned/source marketer.
 */
export async function getAdminViewings(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : undefined;

    const allowedStatuses = Object.values(ViewingStatus);

    const where =
      status && allowedStatuses.includes(status as ViewingStatus)
        ? {
            status: status as ViewingStatus,
          }
        : {};

    const viewings = await prisma.viewingRequest.findMany({
      where,

      orderBy: [
        {
          createdAt: "desc",
        },
      ],

      include: {
        renter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
            accountStatus: true,
          },
        },

        property: {
          select: {
            id: true,
            title: true,
            purpose: true,
            longStayType: true,
            monthlyRent: true,
            viewingFee: true,
            deposit: true,
            available: true,
            verified: true,
            status: true,
            county: true,
            town: true,
            area: true,

            countyRelation: {
              select: {
                id: true,
                name: true,
              },
            },

            constituency: {
              select: {
                id: true,
                name: true,
              },
            },

            ward: {
              select: {
                id: true,
                name: true,
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
                    isActive: true,
                    accountStatus: true,
                  },
                },
              },
            },

            images: {
              orderBy: {
                createdAt: "asc",
              },
              select: {
                id: true,
                url: true,
                sortOrder: true,
                isPrimary: true,
              },
              take: 1,
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
                isActive: true,
                accountStatus: true,
              },
            },
          },
        },

        payments: {
          orderBy: {
            createdAt: "desc",
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
            createdAt: true,
          },
        },

        statusHistory: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            status: true,
            note: true,
            changedById: true,
            createdAt: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        viewings,
        count: viewings.length,
      },
    });
  } catch (error) {
    console.error(
      "getAdminViewings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load admin viewings",
    });
  }
}

/**
 * GET /api/admin/viewings/:viewingId
 *
 * Admin viewing detail.
 *
 * Admin is allowed to see all operational contact information.
 */
export async function getAdminViewing(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const viewingId = getViewingId(req);

    if (!viewingId) {
      return res.status(400).json({
        success: false,
        message: "Viewing ID is required",
      });
    }

    const viewing =
      await prisma.viewingRequest.findUnique({
        where: {
          id: viewingId,
        },

        include: {
          renter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              isActive: true,
              accountStatus: true,
            },
          },

          property: {
            select: {
              id: true,
              title: true,
              description: true,
              purpose: true,
              longStayType: true,
              monthlyRent: true,
              deposit: true,
              viewingFee: true,
              serviceCharge: true,
              bedrooms: true,
              bathrooms: true,
              furnishing: true,
              available: true,
              verified: true,
              status: true,
              county: true,
              town: true,
              area: true,

              countyRelation: {
                select: {
                  id: true,
                  name: true,
                },
              },

              constituency: {
                select: {
                  id: true,
                  name: true,
                },
              },

              ward: {
                select: {
                  id: true,
                  name: true,
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
                      isActive: true,
                      accountStatus: true,
                    },
                  },
                },
              },

              images: {
                orderBy: {
                  createdAt: "asc",
                },
                select: {
                  id: true,
                  url: true,
                  altText: true,
                  sortOrder: true,
                  isPrimary: true,
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
                  isActive: true,
                  accountStatus: true,
                },
              },
            },
          },

          payments: {
            orderBy: {
              createdAt: "desc",
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
            },
          },

          statusHistory: {
            orderBy: {
              createdAt: "desc",
            },
            select: {
              id: true,
              status: true,
              note: true,
              changedById: true,
              createdAt: true,
            },
          },
        },
      });

    if (!viewing) {
      return res.status(404).json({
        success: false,
        message: "Viewing request not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        viewing,
      },
    });
  } catch (error) {
    console.error(
      "getAdminViewing error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load viewing",
    });
  }
}

/**
 * POST /api/admin/viewings/:viewingId/approve
 *
 * ADMIN APPROVES A PAID VIEWING.
 *
 * IMPORTANT BUSINESS RULE:
 *
 * The admin does NOT supply a marketer ID.
 *
 * The backend automatically takes:
 *
 *     Property.marketerId
 *
 * and assigns it to:
 *
 *     ViewingRequest.assignedMarketerId
 *
 * This means the marketer who sourced/uploaded the
 * property becomes the representative handling the viewing.
 *
 * Only after this operation:
 *
 * - customer can receive marketer contact
 * - marketer can receive customer contact
 */
export async function approveAdminViewing(
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

    const adminUserId = req.user.userId;
    const viewingId = getViewingId(req);

    if (!viewingId) {
      return res.status(400).json({
        success: false,
        message: "Viewing ID is required",
      });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const viewing =
          await tx.viewingRequest.findUnique({
            where: {
              id: viewingId,
            },

            include: {
              property: {
                select: {
                  id: true,
                  title: true,
                  purpose: true,
                  marketerId: true,

                  marketer: {
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
                          isActive: true,
                          accountStatus: true,
                          role: true,
                        },
                      },
                    },
                  },
                },
              },

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

              assignedMarketer: {
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
                      isActive: true,
                      accountStatus: true,
                    },
                  },
                },
              },
            },
          });

        if (!viewing) {
          throw new Error(
            "Viewing request not found"
          );
        }

        /*
         * Idempotency:
         *
         * If the admin presses approve again after
         * the viewing has already been assigned, do
         * not create duplicate assignments or
         * duplicate notifications.
         */
        if (
          viewing.status === ViewingStatus.ASSIGNED &&
          viewing.assignedMarketerId
        ) {
          return {
            viewing,
            alreadyAssigned: true,
          };
        }

        if (
          viewing.status !== ViewingStatus.PAID
        ) {
          throw new Error(
            "Only paid viewing requests can be approved"
          );
        }

        /*
         * The property must have a source marketer.
         */
        if (!viewing.property.marketerId) {
          throw new Error(
            "This property does not have a source marketer"
          );
        }

        const marketer =
          viewing.property.marketer;

        if (!marketer) {
          throw new Error(
            "Source marketer profile not found"
          );
        }

        /*
         * Never assign an inactive marketer.
         */
        if (
          !marketer.user.isActive ||
          marketer.user.accountStatus !== "ACTIVE"
        ) {
          throw new Error(
            "The source marketer is not active"
          );
        }

        /*
         * The marketer must still be a MARKETER account.
         */
        if (marketer.user.role !== "MARKETER") {
          throw new Error(
            "The source marketer account is invalid"
          );
        }

        const now = new Date();

        /*
         * Assign the source marketer and move the
         * viewing into ASSIGNED.
         */
        const updatedViewing =
          await tx.viewingRequest.update({
            where: {
              id: viewing.id,
            },

            data: {
              assignedMarketerId:
                marketer.id,
              assignedAt: now,
              status: ViewingStatus.ASSIGNED,
            },

            include: {
              property: {
                select: {
                  id: true,
                  title: true,
                  purpose: true,
                },
              },

              renter: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
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
                    },
                  },
                },
              },
            },
          });

        /*
         * Record the operational state change.
         */
        await tx.viewingStatusHistory.create({
          data: {
            viewingId: viewing.id,
            status: ViewingStatus.ASSIGNED,
            note:
              "Admin approved the paid viewing and assigned the property's source marketer.",
            changedById: adminUserId,
          },
        });

        /*
         * Notify the CUSTOMER.
         *
         * Do not put internal assignment IDs or
         * operational details in the notification.
         */
        await tx.notification.create({
          data: {
            userId: viewing.renter.id,
            type: NotificationType.VIEWING_ASSIGNED,
            title: "Viewing approved",
            message:
              "Your viewing has been approved. The property representative will coordinate the viewing with you.",
            entityType: "VIEWING",
            entityId: viewing.id,
          },
        });

        /*
         * Notify the MARKETER.
         *
         * This is the point where the marketer knows
         * the paid viewing has been approved and is
         * officially assigned to them.
         */
        await tx.notification.create({
          data: {
            userId: marketer.userId,
            type: NotificationType.VIEWING_ASSIGNED,
            title: "Viewing assigned",
            message:
              `A paid viewing for "${viewing.property.title}" has been approved and assigned to you. Customer contact details are now available in your viewing dashboard.`,
            entityType: "VIEWING",
            entityId: viewing.id,
          },
        });

        return {
          viewing: updatedViewing,
          alreadyAssigned: false,
        };
      }
    );

    return res.status(200).json({
      success: true,
      message: result.alreadyAssigned
        ? "Viewing is already approved and assigned"
        : "Viewing approved and source marketer assigned",
      data: {
        viewing: result.viewing,
      },
    });
  } catch (error) {
    console.error(
      "approveAdminViewing error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to approve viewing";

    if (
      message === "Viewing request not found"
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "Only paid viewing requests can be approved"
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    if (
      message ===
        "This property does not have a source marketer" ||
      message ===
        "Source marketer profile not found"
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    if (
      message ===
      "The source marketer is not active" ||
      message ===
      "The source marketer account is invalid"
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
