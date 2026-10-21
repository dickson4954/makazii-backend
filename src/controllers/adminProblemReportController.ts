import type { Response } from "express";

import {
  ProblemReportStatus,
} from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

function getReportId(
  req: AuthenticatedRequest,
): string | null {
  const value = req.params.id;

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    return null;
  }

  return value.trim();
}

function getAdminUserId(
  req: AuthenticatedRequest,
): string | null {
  const userId = req.user?.userId;

  return typeof userId === "string" &&
    userId.trim().length > 0
    ? userId.trim()
    : null;
}

/**
 * GET /api/admin/problem-reports
 *
 * Admin can see all customer concerns/problem reports.
 */
export async function getAdminProblemReports(
  _req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const reports =
      await prisma.problemReport.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

    const userIds = [
      ...new Set(
        reports
          .map((item) => item.userId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const propertyIds = [
      ...new Set(
        reports
          .map((item) => item.propertyId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const viewingIds = [
      ...new Set(
        reports
          .map((item) => item.viewingId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const marketerIds = [
      ...new Set(
        reports
          .map((item) => item.marketerId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const responderIds = [
      ...new Set(
        reports
          .map((item) => item.respondedById)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [
      users,
      properties,
      viewings,
      marketers,
      responders,
    ] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      }),

      prisma.property.findMany({
        where: {
          id: {
            in: propertyIds,
          },
        },
        select: {
          id: true,
          title: true,
          purpose: true,
          longStayType: true,
          shortStayType: true,
          county: true,
          town: true,
          area: true,
        },
      }),

      prisma.viewingRequest.findMany({
        where: {
          id: {
            in: viewingIds,
          },
        },
        select: {
          id: true,
          propertyId: true,
          renterId: true,
          status: true,
          requestedDate: true,
          preferredTime: true,
          completedAt: true,
          assignedMarketerId: true,
        },
      }),

      prisma.marketer.findMany({
        where: {
          id: {
            in: marketerIds,
          },
        },
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
      }),

      prisma.user.findMany({
        where: {
          id: {
            in: responderIds,
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      }),
    ]);

    const userMap = new Map(
      users.map((user) => [user.id, user]),
    );

    const propertyMap = new Map(
      properties.map((property) => [
        property.id,
        property,
      ]),
    );

    const viewingMap = new Map(
      viewings.map((viewing) => [
        viewing.id,
        viewing,
      ]),
    );

    const marketerMap = new Map(
      marketers.map((marketer) => [
        marketer.id,
        marketer,
      ]),
    );

    const responderMap = new Map(
      responders.map((user) => [
        user.id,
        user,
      ]),
    );

    const data = reports.map((item) => ({
      id: item.id,
      category: item.category,
      customerCategory:
        item.customerCategory ?? null,
      message: item.message,
      propertyId: item.propertyId,
      viewingId: item.viewingId,
      marketerId: item.marketerId,
      status: item.status,
      adminResponse: item.adminResponse,
      respondedAt: item.respondedAt,
      respondedById: item.respondedById,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,

      customer: item.userId
        ? userMap.get(item.userId) ?? null
        : null,

      property: item.propertyId
        ? propertyMap.get(item.propertyId) ?? null
        : null,

      viewing: item.viewingId
        ? viewingMap.get(item.viewingId) ?? null
        : null,

      marketer: item.marketerId
        ? marketerMap.get(item.marketerId) ?? null
        : null,

      respondedBy: item.respondedById
        ? responderMap.get(item.respondedById) ?? null
        : null,
    }));

    return res.status(200).json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error(
      "getAdminProblemReports error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load customer problem reports",
    });
  }
}

/**
 * GET /api/admin/problem-reports/:id
 *
 * Admin problem-report detail.
 */
export async function getAdminProblemReport(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const reportId = getReportId(req);

    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: "Problem report ID is required",
      });
    }

    const report =
      await prisma.problemReport.findUnique({
        where: {
          id: reportId,
        },
      });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Problem report not found",
      });
    }

    const [
      customer,
      property,
      viewing,
      marketer,
      respondedBy,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: report.userId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      }),

      report.propertyId
        ? prisma.property.findUnique({
            where: {
              id: report.propertyId,
            },
            select: {
              id: true,
              title: true,
              purpose: true,
              longStayType: true,
              shortStayType: true,
              county: true,
              town: true,
              area: true,
            },
          })
        : null,

      report.viewingId
        ? prisma.viewingRequest.findUnique({
            where: {
              id: report.viewingId,
            },
            select: {
              id: true,
              propertyId: true,
              renterId: true,
              status: true,
              requestedDate: true,
              preferredTime: true,
              completedAt: true,
              assignedMarketerId: true,
            },
          })
        : null,

      report.marketerId
        ? prisma.marketer.findUnique({
            where: {
              id: report.marketerId,
            },
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
          })
        : null,

      report.respondedById
        ? prisma.user.findUnique({
            where: {
              id: report.respondedById,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          })
        : null,
    ]);

    return res.status(200).json({
      success: true,
      data: {
        id: report.id,
        category: report.category,
        customerCategory:
          report.customerCategory ?? null,
        message: report.message,
        propertyId: report.propertyId,
        viewingId: report.viewingId,
        marketerId: report.marketerId,
        status: report.status,
        adminResponse: report.adminResponse,
        respondedAt: report.respondedAt,
        respondedById: report.respondedById,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        customer,
        property,
        viewing,
        marketer,
        respondedBy,
      },
    });
  } catch (error) {
    console.error(
      "getAdminProblemReport error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load customer problem report",
    });
  }
}

/**
 * PATCH /api/admin/problem-reports/:id
 *
 * Admin updates the concern status and/or internal response.
 */
export async function updateAdminProblemReport(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const reportId = getReportId(req);
    const adminUserId = getAdminUserId(req);

    if (!reportId) {
      return res.status(400).json({
        success: false,
        message: "Problem report ID is required",
      });
    }

    if (!adminUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const existing =
      await prisma.problemReport.findUnique({
        where: {
          id: reportId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Problem report not found",
      });
    }

    const body = req.body ?? {};

    const status =
      typeof body.status === "string"
        ? body.status.trim()
        : undefined;

    const adminResponse =
      typeof body.adminResponse === "string"
        ? body.adminResponse.trim()
        : undefined;

    const allowedStatuses =
      Object.values(ProblemReportStatus);

    if (
      status !== undefined &&
      !allowedStatuses.includes(
        status as ProblemReportStatus,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid problem report status",
      });
    }

    if (
      adminResponse !== undefined &&
      adminResponse.length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Admin response cannot exceed 1000 characters",
      });
    }

    const nextStatus =
      status !== undefined
        ? (status as ProblemReportStatus)
        : existing.status;

    const hasResponseChange =
      adminResponse !== undefined;

    const report =
      await prisma.problemReport.update({
        where: {
          id: reportId,
        },
        data: {
          ...(status !== undefined
            ? {
                status: nextStatus,
              }
            : {}),

          ...(hasResponseChange
            ? {
                adminResponse:
                  adminResponse || null,
                respondedAt:
                  adminResponse
                    ? new Date()
                    : null,
                respondedById:
                  adminResponse
                    ? adminUserId
                    : null,
              }
            : {}),
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Problem report updated successfully",
      data: {
        id: report.id,
        category: report.category,
        customerCategory:
          report.customerCategory ?? null,
        message: report.message,
        propertyId: report.propertyId,
        viewingId: report.viewingId,
        marketerId: report.marketerId,
        status: report.status,
        adminResponse: report.adminResponse,
        respondedAt: report.respondedAt,
        respondedById: report.respondedById,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "updateAdminProblemReport error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update customer problem report",
    });
  }
}
