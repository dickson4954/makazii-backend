import type { Response } from "express";
import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

export async function getMarketerFeedback(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const marketer = await prisma.marketer.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Marketer profile not found",
      });
    }

    const marketerId = marketer.id;

    const [ratings, concerns] = await Promise.all([
      prisma.feedback.findMany({
        where: {
          marketerId,
          category: "VIEWING",
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.problemReport.findMany({
        where: { marketerId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const userIds = [
      ...new Set([
        ...ratings.map((item) => item.userId),
        ...concerns.map((item) => item.userId),
      ]),
    ];

    const propertyIds = [
      ...new Set([
        ...ratings
          .map((item) => item.propertyId)
          .filter((id): id is string => id !== null),
        ...concerns
          .map((item) => item.propertyId)
          .filter((id): id is string => id !== null),
      ]),
    ];

    const viewingIds = [
      ...new Set([
        ...ratings
          .map((item) => item.viewingId)
          .filter((id): id is string => id !== null),
        ...concerns
          .map((item) => item.viewingId)
          .filter((id): id is string => id !== null),
      ]),
    ];

    const [users, properties, viewings] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
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
          id: { in: propertyIds },
          marketerId,
        },
        select: {
          id: true,
          title: true,
          purpose: true,
          longStayType: true,
          shortStayType: true,
          monthlyRent: true,
          viewingFee: true,
          dayRate: true,
          nightRate: true,
          dayNightRate: true,
          bedrooms: true,
          bathrooms: true,
          beds: true,
          rooms: true,
          maxGuests: true,
          furnishing: true,
          county: true,
          town: true,
          area: true,
          available: true,
          verified: true,
          status: true,
        },
      }),

      prisma.viewingRequest.findMany({
        where: {
          id: { in: viewingIds },
          property: { marketerId },
        },
        select: {
          id: true,
          propertyId: true,
          renterId: true,
          status: true,
          requestedDate: true,
          preferredTime: true,
          scheduledAt: true,
          confirmedAt: true,
          completedAt: true,
        },
      }),
    ]);

    const userMap = new Map(users.map((item) => [item.id, item]));
    const propertyMap = new Map(
      properties.map((item) => [item.id, item]),
    );
    const viewingMap = new Map(
      viewings.map((item) => [item.id, item]),
    );

    const ratingData = ratings
      .filter(
        (item) =>
          item.propertyId &&
          propertyMap.has(item.propertyId),
      )
      .map((item) => ({
        id: item.id,
        category: item.category,
        rating: item.rating,
        message: item.message,
        propertyId: item.propertyId,
        viewingId: item.viewingId,
        marketerId: item.marketerId,
        createdAt: item.createdAt,
        customer: userMap.get(item.userId) ?? null,
        property: item.propertyId
          ? propertyMap.get(item.propertyId) ?? null
          : null,
        viewing: item.viewingId
          ? viewingMap.get(item.viewingId) ?? null
          : null,
      }));

    const concernData = concerns
      .filter(
        (item) =>
          item.propertyId &&
          propertyMap.has(item.propertyId),
      )
      .map((item) => ({
        id: item.id,
        category: item.category,
        customerCategory: item.customerCategory,
        message: item.message,
        propertyId: item.propertyId,
        viewingId: item.viewingId,
        marketerId: item.marketerId,
        status: item.status,
        adminResponse: item.adminResponse,
        respondedAt: item.respondedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        customer: userMap.get(item.userId) ?? null,
        property: item.propertyId
          ? propertyMap.get(item.propertyId) ?? null
          : null,
        viewing: item.viewingId
          ? viewingMap.get(item.viewingId) ?? null
          : null,
      }));

    return res.status(200).json({
      success: true,
      data: {
        ratings: ratingData,
        concerns: concernData,
        ratingCount: ratingData.length,
        concernCount: concernData.length,
        openConcernCount: concernData.filter(
          (item) => item.status === "OPEN",
        ).length,
      },
    });
  } catch (error) {
    console.error("getMarketerFeedback error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load marketer feedback",
    });
  }
}
