import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

export async function getLandlordProblemReports(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const landlord = await prisma.landlord.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!landlord) {
      return res.status(404).json({
        success: false,
        message: "Landlord account was not found.",
      });
    }

    // Ownership is always determined by the authenticated landlord.
    const properties = await prisma.property.findMany({
      where: { landlordId: landlord.id },
      select: {
        id: true,
        title: true,
        purpose: true,
        monthlyRent: true,
        viewingFee: true,
        county: true,
        town: true,
        area: true,
        status: true,
      },
    });

    const propertyIds = properties.map((property) => property.id);

    const viewings = propertyIds.length
      ? await prisma.viewingRequest.findMany({
          where: { propertyId: { in: propertyIds } },
          select: {
            id: true,
            propertyId: true,
            status: true,
            requestedDate: true,
            scheduledAt: true,
            completedAt: true,
          },
        })
      : [];

    const viewingIds = viewings.map((viewing) => viewing.id);

    const reports =
      propertyIds.length > 0 || viewingIds.length > 0
        ? await prisma.problemReport.findMany({
            where: {
              OR: [
                ...(propertyIds.length
                  ? [{ propertyId: { in: propertyIds } }]
                  : []),
                ...(viewingIds.length
                  ? [{ viewingId: { in: viewingIds } }]
                  : []),
              ],
            },
            orderBy: { createdAt: "desc" },
          })
        : [];

    const userIds = [...new Set(reports.map((report) => report.userId))];

    const customers = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        })
      : [];

    const propertyMap = new Map(
      properties.map((property) => [property.id, property]),
    );
    const viewingMap = new Map(
      viewings.map((viewing) => [viewing.id, viewing]),
    );
    const customerMap = new Map(
      customers.map((customer) => [customer.id, customer]),
    );

    // Never return a report unless its property or viewing belongs
    // to this landlord, even if the report contains unrelated IDs.
    const concerns = reports
      .filter(
        (report) =>
          (report.propertyId != null &&
            propertyMap.has(report.propertyId)) ||
          (report.viewingId != null &&
            viewingMap.has(report.viewingId)),
      )
      .map((report) => ({
        id: report.id,
        category: report.category,
        customerCategory: report.customerCategory,
        message: report.message,
        propertyId: report.propertyId,
        viewingId: report.viewingId,
        status: report.status,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        customer: customerMap.get(report.userId) ?? null,
        property: report.propertyId
          ? propertyMap.get(report.propertyId) ?? null
          : null,
        viewing: report.viewingId
          ? viewingMap.get(report.viewingId) ?? null
          : null,
      }));

    return res.status(200).json({
      success: true,
      data: {
        concerns,
        count: concerns.length,
        openCount: concerns.filter(
          (report) => report.status === "OPEN",
        ).length,
      },
    });
  } catch (error) {
    console.error("Get landlord problem reports error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load property concerns.",
    });
  }
}
