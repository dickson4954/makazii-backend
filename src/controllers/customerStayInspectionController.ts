import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  createStayInspection,
} from "../services/stayInspectionService";

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

function isInspectionAssigned(
  status: string
): boolean {
  return (
    status === "ASSIGNED" ||
    status === "CONFIRMED" ||
    status === "COMPLETED"
  );
}

/**
 * POST /api/stay-inspections
 *
 * Customer creates a short-stay inspection request.
 */
export async function createCustomerStayInspection(
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

    const { propertyId, requestedDate, preferredTime, notes } =
      req.body ?? {};

    if (
      typeof propertyId !== "string" ||
      propertyId.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    let parsedDate: Date | undefined;

    if (requestedDate !== undefined && requestedDate !== null) {
      if (
        typeof requestedDate !== "string" ||
        Number.isNaN(
          new Date(requestedDate).getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid requested date",
        });
      }

      parsedDate = new Date(requestedDate);
    }

    if (
      preferredTime !== undefined &&
      preferredTime !== null &&
      typeof preferredTime !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid preferred time",
      });
    }

    if (
      notes !== undefined &&
      notes !== null &&
      typeof notes !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid notes",
      });
    }

    const inspection = await createStayInspection(
      propertyId.trim(),
      req.user.userId,
      parsedDate,
      preferredTime,
      notes
    );

    return res.status(201).json({
      success: true,
      message:
        "Inspection request created. Complete the inspection payment to continue.",
      data: {
        inspection,
      },
    });
  } catch (error) {
    console.error(
      "createCustomerStayInspection error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create inspection request";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * GET /api/stay-inspections
 *
 * Customer sees only their own inspection requests.
 *
 * Privacy:
 * - Before ASSIGNED, no representative contact is exposed.
 * - If a marketer created the property and is assigned,
 *   assignedRepresentative and assignedMarketer contain
 *   the marketer.
 * - If an admin created the property and is assigned,
 *   assignedRepresentative contains the creating admin and
 *   assignedMarketer remains null.
 */
export async function getCustomerStayInspections(
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

    const inspections =
      await prisma.stayInspection.findMany({
        where: {
          renterId: req.user.userId,
        },

        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          requestedDate: true,
          preferredTime: true,
          notes: true,
          status: true,
          confirmedAt: true,
          completedAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,

          property: {
            select: {
              id: true,
              title: true,
              purpose: true,
              shortStayType: true,

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
                  sortOrder: true,
                  isPrimary: true,
                },
                take: 1,
              },

              createdBy: {
                select: {
                  id: true,
                  role: true,
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
              providerReference: true,
              status: true,
              paidAt: true,
              createdAt: true,
            },
          },

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
        },
      });

    const safeInspections = inspections.map(
      (inspection) => {
        const assigned =
          isInspectionAssigned(inspection.status);

        const assignedRepresentative =
          assigned && inspection.property.createdBy
            ? inspection.property.createdBy
            : null;

        return {
          ...inspection,

          assignedRepresentative,

          assignedMarketer:
            assigned
              ? inspection.assignedMarketer
              : null,
        };
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        inspections: safeInspections,
        count: safeInspections.length,
      },
    });
  } catch (error) {
    console.error(
      "getCustomerStayInspections error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load inspections",
    });
  }
}

/**
 * GET /api/stay-inspections/:inspectionId
 *
 * Customer sees one of their own inspections.
 */
export async function getCustomerStayInspection(
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

    const inspectionId = getInspectionId(req);

    if (!inspectionId) {
      return res.status(400).json({
        success: false,
        message: "Inspection ID is required",
      });
    }

    const inspection =
      await prisma.stayInspection.findFirst({
        where: {
          id: inspectionId,
          renterId: req.user.userId,
        },

        select: {
          id: true,
          requestedDate: true,
          preferredTime: true,
          notes: true,
          status: true,
          confirmedAt: true,
          completedAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,

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

              createdBy: {
                select: {
                  id: true,
                  role: true,
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
              providerReference: true,
              status: true,
              paidAt: true,
              createdAt: true,
            },
          },

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
        },
      });

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: "Inspection request not found",
      });
    }

    const assigned =
      isInspectionAssigned(inspection.status);

    const assignedRepresentative =
      assigned && inspection.property.createdBy
        ? inspection.property.createdBy
        : null;

    const safeInspection = {
      ...inspection,

      assignedRepresentative,

      assignedMarketer:
        assigned
          ? inspection.assignedMarketer
          : null,
    };

    return res.status(200).json({
      success: true,
      data: {
        inspection: safeInspection,
      },
    });
  } catch (error) {
    console.error(
      "getCustomerStayInspection error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load inspection",
    });
  }
}
