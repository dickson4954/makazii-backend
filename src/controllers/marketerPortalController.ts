import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * ============================================================
 * MARKETER PORTAL
 *
 * These endpoints are for the currently authenticated marketer.
 *
 * The marketer is identified from the JWT:
 *
 * JWT userId
 *    ↓
 * User
 *    ↓
 * Marketer
 *    ↓
 * MarketerCoverage
 *
 * A marketer can ONLY access their own portal data here.
 * ============================================================
 */

/**
 * ============================================================
 * GET CURRENT MARKETER
 *
 * GET /api/marketer/me
 *
 * Returns:
 * - authenticated user information
 * - marketer profile
 * - county
 * - constituency
 * - selected wards
 * - assigned places
 * - property statistics
 * - viewing statistics
 * ============================================================
 */
export async function getCurrentMarketer(
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

    const userId = req.user.userId;

    /**
     * --------------------------------------------------------
     * FIND MARKETER THROUGH AUTHENTICATED USER
     * --------------------------------------------------------
     */
    const marketer = await prisma.marketer.findUnique({
      where: {
        userId,
      },
      include: {
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
            statusReason: true,
            statusChangedAt: true,
            emailVerifiedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },

        /**
         * ----------------------------------------------------
         * MARKETER COVERAGE
         * ----------------------------------------------------
         */
        coverage: {
          include: {
            county: {
              select: {
                id: true,
                sourceId: true,
                name: true,
              },
            },

            constituency: {
              select: {
                id: true,
                sourceId: true,
                name: true,
                countyId: true,
              },
            },
          },
        },

        /**
         * ----------------------------------------------------
         * LEGACY PLACE ASSIGNMENTS
         *
         * Kept because some existing data may still use them.
         * ----------------------------------------------------
         */
        places: {
          orderBy: {
            assignedAt: "asc",
          },
          include: {
            place: {
              select: {
                id: true,
                name: true,
                countyId: true,
              },
            },
          },
        },

        /**
         * ----------------------------------------------------
         * PROPERTY COUNTS
         * ----------------------------------------------------
         */
        _count: {
          select: {
            properties: true,
            viewings: true,
            places: true,
          },
        },
      },
    });

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Marketer profile not found",
      });
    }

    /**
     * A MARKETER role without a marketer profile should never
     * normally happen, but this protects the endpoint from
     * malformed data.
     */
    if (marketer.user.role !== "MARKETER") {
      return res.status(403).json({
        success: false,
        message: "This account is not a marketer account",
      });
    }

    if (!marketer.user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your marketer account is inactive",
      });
    }

    /**
     * --------------------------------------------------------
     * RESOLVE WARD DETAILS
     *
     * MarketerCoverage stores ward IDs as String[].
     *
     * We convert those IDs into actual ward records so the
     * frontend receives names instead of having to perform
     * another geography lookup.
     * --------------------------------------------------------
     */
    let wards: Array<{
      id: string;
      sourceId: string;
      name: string;
      constituencyId: string;
    }> = [];

    if (marketer.coverage?.wardIds.length) {
      wards = await prisma.ward.findMany({
        where: {
          id: {
            in: marketer.coverage.wardIds,
          },
        },
        select: {
          id: true,
          sourceId: true,
          name: true,
          constituencyId: true,
        },
        orderBy: {
          name: "asc",
        },
      });
    }

    /**
     * --------------------------------------------------------
     * PROPERTY STATISTICS
     * --------------------------------------------------------
     *
     * These counts belong only to this marketer.
     */
    const [
      draftProperties,
      pendingVerificationProperties,
      changesRequiredProperties,
      activeProperties,
      rentedProperties,
      inactiveProperties,
      rejectedProperties,
    ] = await Promise.all([
      prisma.property.count({
        where: {
          marketerId: marketer.id,
          status: "DRAFT",
        },
      }),

      prisma.property.count({
        where: {
          marketerId: marketer.id,
          status: "PENDING_VERIFICATION",
        },
      }),

      prisma.property.count({
        where: {
          marketerId: marketer.id,
          status: "CHANGES_REQUIRED",
        },
      }),

      prisma.property.count({
        where: {
          marketerId: marketer.id,
          status: "ACTIVE",
        },
      }),

      prisma.property.count({
        where: {
          marketerId: marketer.id,
          status: "RENTED",
        },
      }),

      prisma.property.count({
        where: {
          marketerId: marketer.id,
          status: "INACTIVE",
        },
      }),

      prisma.property.count({
        where: {
          marketerId: marketer.id,
          status: "REJECTED",
        },
      }),
    ]);

    const totalProperties =
      draftProperties +
      pendingVerificationProperties +
      changesRequiredProperties +
      activeProperties +
      rentedProperties +
      inactiveProperties +
      rejectedProperties;

    /**
     * --------------------------------------------------------
     * VIEWING STATISTICS
     * --------------------------------------------------------
     *
     * The marketer viewing lifecycle is:
     *
     * PAID
     *   -> ASSIGNED
     *      -> APPROVED
     *      -> COMPLETED
     *
     * OR
     *
     * PAID
     *   -> ASSIGNED
     *      -> RESCHEDULED
     *      -> COMPLETED
     *
     * IMPORTANT:
     *
     * PAID is checked through property.marketerId because
     * the property's marketer must be able to see that the
     * customer has paid the viewing fee.
     *
     * Customer contact details are NOT released at PAID.
     *
     * Contact is only exposed after admin assigns the viewing
     * and assignedMarketerId is populated.
     */
    const [
      paidViewings,
      assignedViewings,
      approvedViewings,
      rescheduledViewings,
      completedViewings,
      cancelledViewings,
    ] = await Promise.all([
      prisma.viewingRequest.count({
        where: {
          status: "PAID",
          property: {
            marketerId: marketer.id,
          },
        },
      }),

      prisma.viewingRequest.count({
        where: {
          assignedMarketerId: marketer.id,
          status: "ASSIGNED",
        },
      }),

      prisma.viewingRequest.count({
        where: {
          assignedMarketerId: marketer.id,
          status: "APPROVED",
        },
      }),

      prisma.viewingRequest.count({
        where: {
          assignedMarketerId: marketer.id,
          status: "RESCHEDULED",
        },
      }),

      prisma.viewingRequest.count({
        where: {
          assignedMarketerId: marketer.id,
          status: "COMPLETED",
        },
      }),

      prisma.viewingRequest.count({
        where: {
          assignedMarketerId: marketer.id,
          status: "CANCELLED",
        },
      }),
    ]);

    const totalViewings =
      paidViewings +
      assignedViewings +
      approvedViewings +
      rescheduledViewings +
      completedViewings +
      cancelledViewings;

    /**
     * --------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------
     */
    return res.status(200).json({
      success: true,
      data: {
        marketer: {
          id: marketer.id,

          user: marketer.user,

          notes: marketer.notes,

          createdAt: marketer.createdAt,
          updatedAt: marketer.updatedAt,

          coverage: marketer.coverage
            ? {
                id: marketer.coverage.id,

                county: marketer.coverage.county,

                constituency: marketer.coverage.constituency,

                wards,

                assignedAt: marketer.coverage.assignedAt,
                updatedAt: marketer.coverage.updatedAt,
              }
            : null,

          places: marketer.places.map((assignment) => ({
            id: assignment.place.id,
            name: assignment.place.name,
            countyId: assignment.place.countyId,
            assignedAt: assignment.assignedAt,
          })),

          statistics: {
            properties: {
              total: totalProperties,
              draft: draftProperties,
              pendingVerification:
                pendingVerificationProperties,
              changesRequired: changesRequiredProperties,
              active: activeProperties,
              rented: rentedProperties,
              inactive: inactiveProperties,
              rejected: rejectedProperties,
            },

            viewings: {
              total: totalViewings,
              paid: paidViewings,
              assigned: assignedViewings,
              approved: approvedViewings,
              rescheduled: rescheduledViewings,
              completed: completedViewings,
              cancelled: cancelledViewings,
            },

            /*
             * Legacy place assignments remain available as a
             * separate relationship. The marketer's current
             * official coverage is county/constituency/wards.
             */
            assignedPlaces: marketer.places.length,
          },
        },
      },
    });
  } catch (error) {
    console.error("Get current marketer error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to retrieve marketer profile";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}
