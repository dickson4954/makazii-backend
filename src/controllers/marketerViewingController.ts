import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * GET /api/marketer/viewings
 *
 * Returns only viewing requests that have been officially
 * assigned to the currently authenticated marketer.
 *
 * IMPORTANT PRIVACY RULE:
 *
 * PAID viewings are NOT returned here because they have not
 * yet been approved by an admin.
 *
 * Customer contact details are therefore released only when
 * the viewing reaches ASSIGNED.
 */
export async function getMarketerViewings(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    // --------------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------------
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.userId;

    // --------------------------------------------------------
    // FIND MARKETER PROFILE
    // --------------------------------------------------------
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

    // --------------------------------------------------------
    // VERIFY ROLE
    // --------------------------------------------------------
    if (marketer.user.role !== "MARKETER") {
      return res.status(403).json({
        success: false,
        message: "This account is not a marketer account",
      });
    }

    // --------------------------------------------------------
    // VERIFY ACTIVE ACCOUNT
    // --------------------------------------------------------
    if (
      !marketer.user.isActive ||
      marketer.user.accountStatus !== "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        message: "Your marketer account is inactive",
      });
    }

    // --------------------------------------------------------
    // FIND ONLY APPROVED / ASSIGNED VIEWINGS
    // --------------------------------------------------------
    //
    // We intentionally use assignedMarketerId.
    //
    // PAID:
    //   assignedMarketerId = null
    //   -> marketer does NOT receive customer details
    //
    // ASSIGNED:
    //   assignedMarketerId = this marketer
    //   -> marketer receives the viewing and customer contact
    //
    const viewings = await prisma.viewingRequest.findMany({
      where: {
        assignedMarketerId: marketer.id,
        status: {
          in: [
            "ASSIGNED",
            "APPROVED",
            "RESCHEDULED",
            "COMPLETED",
            // Legacy records may still contain CONFIRMED.
            "CONFIRMED",
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
        // ----------------------------------------------------
        // CUSTOMER INFORMATION
        // ----------------------------------------------------
        //
        // This is intentionally returned only because the
        // viewing is assigned to this marketer.
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

        // ----------------------------------------------------
        // PROPERTY INFORMATION
        // ----------------------------------------------------
        property: {
          select: {
            id: true,
            title: true,
            purpose: true,
            longStayType: true,
            shortStayType: true,
            monthlyRent: true,
            deposit: true,
            viewingFee: true,

            dayRate: true,
            nightRate: true,
            dayNightRate: true,
            stayMode: true,

            bedrooms: true,
            bathrooms: true,
            beds: true,
            maxGuests: true,
            rooms: true,
            furnishing: true,

            description: true,
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

            images: {
              orderBy: {
                createdAt: "asc",
              },
              select: {
                id: true,
                url: true,
                sortOrder: true,
              },
              take: 1,
            },
          },
        },

        // ----------------------------------------------------
        // VIEWING STATUS HISTORY
        // ----------------------------------------------------
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

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------
    return res.status(200).json({
      success: true,
      data: {
        viewings,
        count: viewings.length,
      },
    });
  } catch (error) {
    console.error("getMarketerViewings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load marketer viewings",
    });
  }
}
