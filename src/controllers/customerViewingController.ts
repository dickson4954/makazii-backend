import type { Response } from "express";

import {
  ViewingRequestedBy,
  ViewingStatus,
} from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * Customer viewing privacy rules
 *
 * BEFORE ADMIN APPROVAL:
 * - Customer can see the viewing status.
 * - Customer can see their payment status once payment succeeds.
 * - Customer cannot see marketer contact.
 * - Internal assignment fields are never returned.
 *
 * AFTER ADMIN APPROVAL:
 * - The property's marketer has been assigned to this viewing.
 * - Customer can see the assigned marketer's contact.
 * - Customer still does not see assignedMarketerId or assignedAt.
 */
function canReleaseMarketerContact(status: ViewingStatus) {
  return (
    status === ViewingStatus.ASSIGNED ||
    status === ViewingStatus.APPROVED ||
    status === ViewingStatus.RESCHEDULED ||
    status === ViewingStatus.COMPLETED ||
    // Legacy records.
    status === ViewingStatus.CONFIRMED
  );
}

/**
 * POST /api/viewings
 *
 * Customer creates a long-stay viewing request.
 *
 * Workflow:
 *
 * 1. Customer creates request.
 * 2. Viewing starts as PENDING_PAYMENT.
 * 3. No marketer contact is exposed.
 * 4. Customer pays viewing fee.
 * 5. Viewing becomes PAID.
 * 6. Customer is informed that payment succeeded.
 * 7. Admin sees the paid viewing.
 * 8. Admin approves the viewing.
 * 9. Property's marketer is assigned to the viewing.
 * 10. Marketer receives customer contact details.
 * 11. Customer receives the assigned marketer's contact details.
 * 12. Marketer approves the requested time OR reschedules it.
 * 13. Customer sees the approved/rescheduled appointment time.
 * 14. After the actual viewing happens, the marketer marks it COMPLETED.
 */
export async function createCustomerViewing(
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

    const renter = await prisma.user.findUnique({
      where: {
        id: renterId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
        accountStatus: true,
      },
    });

    if (!renter) {
      return res.status(401).json({
        success: false,
        message: "Customer account not found",
      });
    }

    if (renter.role !== "RENTER") {
      return res.status(403).json({
        success: false,
        message: "Only customers can request viewings",
      });
    }

    if (
      !renter.isActive ||
      renter.accountStatus !== "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        message: "Your customer account is inactive",
      });
    }

    const {
      propertyId,
      requestedDate,
      preferredTime,
      notes,
    } = req.body;

    if (
      typeof propertyId !== "string" ||
      !propertyId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    const normalizedPropertyId = propertyId.trim();

    const property = await prisma.property.findUnique({
      where: {
        id: normalizedPropertyId,
      },
      select: {
        id: true,
        title: true,
        purpose: true,
        longStayType: true,
        monthlyRent: true,
        deposit: true,
        viewingFee: true,
        serviceCharge: true,
        status: true,
        available: true,
        verified: true,

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

        place: {
          select: {
            id: true,
            name: true,
          },
        },

        images: {
          orderBy: [
            {
              isPrimary: "desc",
            },
            {
              sortOrder: "asc",
            },
          ],
          select: {
            id: true,
            url: true,
            sortOrder: true,
            isPrimary: true,
          },
          take: 1,
        },
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (property.purpose !== "LONG_STAY") {
      return res.status(400).json({
        success: false,
        message:
          "Viewing requests are only available for long-stay properties",
      });
    }

    if (property.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message:
          "This property is not currently available for viewing requests",
      });
    }

    if (!property.available) {
      return res.status(400).json({
        success: false,
        message:
          "This property is currently unavailable",
      });
    }

    if (!property.verified) {
      return res.status(400).json({
        success: false,
        message:
          "This property has not been verified for customer viewing",
      });
    }

    if (
      property.viewingFee === null ||
      property.viewingFee === undefined ||
      property.viewingFee < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This property does not have a valid viewing fee configured",
      });
    }

    const existingRequest =
      await prisma.viewingRequest.findFirst({
        where: {
          renterId,
          propertyId: property.id,
          status: {
            in: [
              ViewingStatus.PENDING_PAYMENT,
              ViewingStatus.PAID,
              ViewingStatus.AWAITING_ASSIGNMENT,
              ViewingStatus.ASSIGNED,
              ViewingStatus.APPROVED,
              ViewingStatus.RESCHEDULED,
              // Legacy records.
              ViewingStatus.CONFIRMED,
            ],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          status: true,
          requestedDate: true,
          preferredTime: true,
          createdAt: true,
        },
      });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message:
          "You already have an active viewing request for this property",
        data: {
          viewing: existingRequest,
        },
      });
    }

    let parsedRequestedDate: Date | null = null;

    if (
      requestedDate !== undefined &&
      requestedDate !== null &&
      requestedDate !== ""
    ) {
      if (typeof requestedDate !== "string") {
        return res.status(400).json({
          success: false,
          message: "requestedDate must be a valid date",
        });
      }

      const parsedDate = new Date(requestedDate);

      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "requestedDate must be a valid date",
        });
      }

      parsedRequestedDate = parsedDate;
    }

    if (
      preferredTime !== undefined &&
      preferredTime !== null &&
      typeof preferredTime !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "preferredTime must be a string",
      });
    }

    if (
      notes !== undefined &&
      notes !== null &&
      typeof notes !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "notes must be a string",
      });
    }

    const viewing = await prisma.$transaction(
      async (tx) => {
        const createdViewing =
          await tx.viewingRequest.create({
            data: {
              propertyId: property.id,
              renterId,

              requestedDate: parsedRequestedDate,

              preferredTime:
                typeof preferredTime === "string"
                  ? preferredTime.trim() || null
                  : null,

              notes:
                typeof notes === "string"
                  ? notes.trim() || null
                  : null,

              status: ViewingStatus.PENDING_PAYMENT,

              requestedBy:
                ViewingRequestedBy.RENTER,

              assignedMarketerId: null,
            },

            include: {
              property: {
                select: {
                  id: true,
                  title: true,
                  purpose: true,
                  longStayType: true,
                  monthlyRent: true,
                  deposit: true,
                  viewingFee: true,
                  serviceCharge: true,
                  available: true,
                  status: true,
                  verified: true,

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

                  place: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },

                  images: {
                    orderBy: [
                      {
                        isPrimary: "desc",
                      },
                      {
                        sortOrder: "asc",
                      },
                    ],
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
            },
          });

        await tx.viewingStatusHistory.create({
          data: {
            viewingId: createdViewing.id,
            status: ViewingStatus.PENDING_PAYMENT,
            note:
              "Customer created viewing request. Awaiting viewing fee payment.",
            changedById: renterId,
          },
        });

        return createdViewing;
      }
    );

    return res.status(201).json({
      success: true,
      message:
        "Viewing request created. Please complete the viewing fee payment.",
      data: {
        viewing,
        payment: {
          required: true,
          amount: property.viewingFee,
          currency: "KES",
        },
      },
    });
  } catch (error) {
    console.error(
      "createCustomerViewing error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create viewing request",
    });
  }
}

/**
 * Builds the customer-safe viewing response.
 *
 * INTERNAL FIELDS NEVER RETURNED:
 * - assignedMarketerId
 * - assignedAt
 *
 * IMPORTANT:
 * The customer does not receive marketer contact merely because
 * the property has a marketer.
 *
 * Contact is released after Admin approval changes the viewing
 * to ASSIGNED and remains available through APPROVED, RESCHEDULED,
 * and COMPLETED.
 *
 * Since the property's source marketer is the marketer assigned to
 * handle its viewings, assignedMarketer is the authoritative relation
 * for this viewing.
 */
function formatCustomerViewing(viewing: any) {
  const releaseContact = canReleaseMarketerContact(
    viewing.status
  );

  const marketer =
    releaseContact &&
    viewing.assignedMarketer?.user
      ? {
          firstName:
            viewing.assignedMarketer.user.firstName,
          lastName:
            viewing.assignedMarketer.user.lastName,
          phone:
            viewing.assignedMarketer.user.phone,
          email:
            viewing.assignedMarketer.user.email,
        }
      : null;

  return {
    id: viewing.id,
    propertyId: viewing.propertyId,
    requestedDate: viewing.requestedDate,
    preferredTime: viewing.preferredTime,
    scheduledAt: viewing.scheduledAt,
    notes: viewing.notes,
    status: viewing.status,
    requestedBy: viewing.requestedBy,
    confirmedAt: viewing.confirmedAt,
    completedAt: viewing.completedAt,
    cancelledAt: viewing.cancelledAt,
    createdAt: viewing.createdAt,
    updatedAt: viewing.updatedAt,

    property: {
      id: viewing.property.id,
      title: viewing.property.title,
      purpose: viewing.property.purpose,
      longStayType: viewing.property.longStayType,
      monthlyRent: viewing.property.monthlyRent,
      deposit: viewing.property.deposit,
      viewingFee: viewing.property.viewingFee,
      serviceCharge: viewing.property.serviceCharge,
      available: viewing.property.available,
      verified: viewing.property.verified,
      status: viewing.property.status,

      location: {
        county: viewing.property.countyRelation,
        constituency: viewing.property.constituency,
        ward: viewing.property.ward,
        place: viewing.property.place,
      },

      images: viewing.property.images,
    },

    payment: viewing.payments?.[0]
      ? {
          id: viewing.payments[0].id,
          amount: viewing.payments[0].amount,
          currency: viewing.payments[0].currency,
          method: viewing.payments[0].method,
          provider: viewing.payments[0].provider,
          reference: viewing.payments[0].reference,
          status: viewing.payments[0].status,
          paidAt: viewing.payments[0].paidAt,
        }
      : null,

    marketer,

    statusHistory: viewing.statusHistory,
  };
}

/**
 * GET /api/viewings
 *
 * Returns the authenticated customer's viewing requests.
 *
 * A customer can only see their own viewings.
 */
export async function getCustomerViewings(
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

    const renter = await prisma.user.findUnique({
      where: {
        id: renterId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
        accountStatus: true,
      },
    });

    if (!renter) {
      return res.status(401).json({
        success: false,
        message: "Customer account not found",
      });
    }

    if (renter.role !== "RENTER") {
      return res.status(403).json({
        success: false,
        message: "Only customers can access customer viewings",
      });
    }

    if (
      !renter.isActive ||
      renter.accountStatus !== "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        message: "Your customer account is inactive",
      });
    }

    const viewings = await prisma.viewingRequest.findMany({
      where: {
        renterId,
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {
        /*
         * The property marketer remains useful internally as the
         * source of the assignment, but it is NOT used by the
         * customer formatter for contact release.
         */
        property: {
          select: {
            id: true,
            title: true,
            purpose: true,
            longStayType: true,
            monthlyRent: true,
            deposit: true,
            viewingFee: true,
            serviceCharge: true,
            available: true,
            verified: true,
            status: true,

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

            place: {
              select: {
                id: true,
                name: true,
              },
            },

            images: {
              orderBy: [
                {
                  isPrimary: "desc",
                },
                {
                  sortOrder: "asc",
                },
              ],
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

        /*
         * This is the marketer officially assigned to THIS viewing.
         *
         * It will normally be the same marketer as property.marketer,
         * because the property's marketer handles its own viewings.
         *
         * Contact is still hidden by formatCustomerViewing until
         * the viewing status reaches ASSIGNED or later.
         */
        assignedMarketer: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
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
            status: true,
            paidAt: true,
          },
          take: 1,
        },

        statusHistory: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            status: true,
            note: true,
            createdAt: true,
          },
        },
      },
    });

    const formattedViewings = viewings.map(
      formatCustomerViewing
    );

    return res.status(200).json({
      success: true,
      data: {
        viewings: formattedViewings,
        count: formattedViewings.length,
      },
    });
  } catch (error) {
    console.error(
      "getCustomerViewings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load your viewings",
    });
  }
}

/**
 * GET /api/viewings/:viewingId
 *
 * Returns one viewing belonging to the authenticated customer.
 */
export async function getCustomerViewing(
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
    const viewingId = req.params.viewingId;

    if (
      typeof viewingId !== "string" ||
      !viewingId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Viewing ID is required",
      });
    }

    const viewing = await prisma.viewingRequest.findFirst({
      where: {
        id: viewingId.trim(),
        renterId,
      },

      include: {
        property: {
          select: {
            id: true,
            title: true,
            purpose: true,
            longStayType: true,
            monthlyRent: true,
            deposit: true,
            viewingFee: true,
            serviceCharge: true,
            available: true,
            verified: true,
            status: true,

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

            place: {
              select: {
                id: true,
                name: true,
              },
            },

            images: {
              orderBy: [
                {
                  isPrimary: "desc",
                },
                {
                  sortOrder: "asc",
                },
              ],
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

        /*
         * The assigned marketer is intentionally loaded separately
         * from property.marketer.
         *
         * Admin approval creates this assignment.
         */
        assignedMarketer: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
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
            status: true,
            paidAt: true,
          },
          take: 1,
        },

        statusHistory: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            status: true,
            note: true,
            createdAt: true,
          },
        },
      },
    });

    if (!viewing) {
      return res.status(404).json({
        success: false,
        message: "Viewing not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        viewing: formatCustomerViewing(viewing),
      },
    });
  } catch (error) {
    console.error(
      "getCustomerViewing error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load viewing",
    });
  }
}
