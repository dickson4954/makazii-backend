import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * GET /api/admin/feedback
 *
 * Admin can see all customer ratings.
 *
 * Related customer/property/viewing/marketer information is resolved
 * from the IDs stored on the Feedback record because Feedback does not
 * currently have Prisma relations to those models.
 */
export async function getAdminFeedback(
  _req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const feedback = await prisma.feedback.findMany({
      where: {
        category: "VIEWING",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const userIds = [
      ...new Set(
        feedback
          .map((item) => item.userId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const propertyIds = [
      ...new Set(
        feedback
          .map((item) => item.propertyId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const viewingIds = [
      ...new Set(
        feedback
          .map((item) => item.viewingId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const marketerIds = [
      ...new Set(
        feedback
          .map((item) => item.marketerId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [users, properties, viewings, marketers] =
      await Promise.all([
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
      ]);

    const userMap = new Map(
      users.map((user) => [user.id, user]),
    );

    const propertyMap = new Map(
      properties.map((property) => [property.id, property]),
    );

    const viewingMap = new Map(
      viewings.map((viewing) => [viewing.id, viewing]),
    );

    const marketerMap = new Map(
      marketers.map((marketer) => [marketer.id, marketer]),
    );

    const data = feedback.map((item) => ({
      id: item.id,
      category: item.category,
      rating: item.rating,
      message: item.message,
      propertyId: item.propertyId,
      viewingId: item.viewingId,
      marketerId: item.marketerId,
      createdAt: item.createdAt,

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
    }));

    return res.status(200).json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("getAdminFeedback error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load customer feedback",
    });
  }
}
