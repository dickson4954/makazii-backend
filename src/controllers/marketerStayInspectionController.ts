import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * =========================================================
 * GET MARKETER STAY INSPECTIONS
 * =========================================================
 *
 * GET /api/marketer/inspections
 *
 * Returns only short-stay inspections that have already
 * been approved by admin and assigned to the authenticated
 * marketer.
 *
 * IMPORTANT PRIVACY RULE:
 *
 * PAID inspections are NOT returned.
 *
 * Customer contact information is released only after:
 *
 *     PAID
 *       ↓ admin approval
 *     ASSIGNED
 *
 * and only to the marketer assigned to that inspection.
 */
export async function getMarketerStayInspections(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    // ------------------------------------------------------
    // AUTHENTICATION
    // ------------------------------------------------------

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.userId;

    // ------------------------------------------------------
    // FIND MARKETER PROFILE
    // ------------------------------------------------------

    const marketer = await prisma.marketer.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            role: true,
            isActive: true,
            accountStatus: true,
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

    // ------------------------------------------------------
    // VERIFY ROLE
    // ------------------------------------------------------

    if (marketer.user.role !== "MARKETER") {
      return res.status(403).json({
        success: false,
        message: "This account is not a marketer account",
      });
    }

    // ------------------------------------------------------
    // VERIFY ACTIVE ACCOUNT
    // ------------------------------------------------------

    if (
      !marketer.user.isActive ||
      marketer.user.accountStatus !== "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        message: "Your marketer account is inactive",
      });
    }

    // ------------------------------------------------------
    // FIND ONLY ASSIGNED INSPECTIONS
    // ------------------------------------------------------
    //
    // PAID:
    //   assignedMarketerId = null
    //   -> NOT returned
    //
    // ASSIGNED:
    //   assignedMarketerId = this marketer
    //   -> returned
    //
    // CONFIRMED / COMPLETED:
    //   -> also returned
    //

    const inspections =
      await prisma.stayInspection.findMany({
        where: {
          assignedMarketerId: marketer.id,
          status: {
            in: [
              "ASSIGNED",
              "CONFIRMED",
              "COMPLETED",
            ],
          },
        },

        orderBy: [
          {
            requestedDate: "asc",
          },
          {
            createdAt: "desc",
          },
        ],

        include: {
          // ------------------------------------------------
          // CUSTOMER
          // ------------------------------------------------
          //
          // Safe to expose here because the inspection is
          // already assigned to this authenticated marketer.
          //
          renter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },

          // ------------------------------------------------
          // PROPERTY
          // ------------------------------------------------

          property: {
            select: {
              id: true,
              title: true,
              description: true,

              purpose: true,
              shortStayType: true,

              dayRate: true,
              nightRate: true,
              dayNightRate: true,
              stayMode: true,

              viewingFee: true,

              bedrooms: true,
              bathrooms: true,
              beds: true,
              maxGuests: true,
              rooms: true,
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

          // ------------------------------------------------
          // PAYMENT
          // ------------------------------------------------

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
        },
      });

    return res.status(200).json({
      success: true,
      data: {
        inspections,
        count: inspections.length,
      },
    });
  } catch (error) {
    console.error(
      "getMarketerStayInspections error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load marketer inspections",
    });
  }
}

/**
 * =========================================================
 * GET ONE MARKETER STAY INSPECTION
 * =========================================================
 *
 * GET /api/marketer/inspections/:inspectionId
 *
 * Returns one inspection only if it belongs to the
 * authenticated marketer.
 *
 * Customer contact information is available here only
 * after admin approval and assignment.
 */
export async function getMarketerStayInspection(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    // ------------------------------------------------------
    // AUTHENTICATION
    // ------------------------------------------------------

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.userId;
    const inspectionIdParam = req.params.inspectionId;
    const inspectionId =
      typeof inspectionIdParam === "string"
        ? inspectionIdParam
        : inspectionIdParam?.[0];

    if (!inspectionId) {
      return res.status(400).json({
        success: false,
        message: "Inspection ID is required",
      });
    }

    // ------------------------------------------------------
    // FIND MARKETER PROFILE
    // ------------------------------------------------------

    const marketer = await prisma.marketer.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            role: true,
            isActive: true,
            accountStatus: true,
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

    // ------------------------------------------------------
    // VERIFY ROLE
    // ------------------------------------------------------

    if (marketer.user.role !== "MARKETER") {
      return res.status(403).json({
        success: false,
        message: "This account is not a marketer account",
      });
    }

    // ------------------------------------------------------
    // VERIFY ACTIVE ACCOUNT
    // ------------------------------------------------------

    if (
      !marketer.user.isActive ||
      marketer.user.accountStatus !== "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        message: "Your marketer account is inactive",
      });
    }

    // ------------------------------------------------------
    // FIND INSPECTION
    // ------------------------------------------------------
    //
    // The assignedMarketerId condition is part of the
    // database query itself.
    //
    // This prevents Marketer A from accessing an inspection
    // belonging to Marketer B.
    //

    const inspection =
      await prisma.stayInspection.findFirst({
        where: {
          id: inspectionId,
          assignedMarketerId: marketer.id,
          status: {
            in: [
              "ASSIGNED",
              "CONFIRMED",
              "COMPLETED",
            ],
          },
        },

        include: {
          // ------------------------------------------------
          // CUSTOMER
          // ------------------------------------------------

          renter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },

          // ------------------------------------------------
          // PROPERTY
          // ------------------------------------------------

          property: {
            select: {
              id: true,
              title: true,
              description: true,

              purpose: true,
              shortStayType: true,

              dayRate: true,
              nightRate: true,
              dayNightRate: true,
              stayMode: true,

              viewingFee: true,

              bedrooms: true,
              bathrooms: true,
              beds: true,
              maxGuests: true,
              rooms: true,
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

          // ------------------------------------------------
          // ASSIGNED MARKETER
          // ------------------------------------------------

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

          // ------------------------------------------------
          // PAYMENTS
          // ------------------------------------------------

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
        },
      });

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message:
          "Inspection not found or it has not been assigned to you",
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
      "getMarketerStayInspection error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load marketer inspection",
    });
  }
}
