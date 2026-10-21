import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import prisma from "../config/prisma";

const visibleProperty = {
  status: "ACTIVE" as const,
  available: true,
  verified: true,
};

function userIdOf(req: AuthenticatedRequest) {
  return req.user?.userId ?? null;
}

function propertyIdOf(req: AuthenticatedRequest) {
  return String(req.params.propertyId ?? "").trim();
}

async function propertyExists(propertyId: string) {
  if (!propertyId) return false;

  return Boolean(
    await prisma.property.findFirst({
      where: { id: propertyId, ...visibleProperty },
      select: { id: true },
    }),
  );
}

function utcDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function getEngagementSummary(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = userIdOf(req);
    const propertyId = propertyIdOf(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!(await propertyExists(propertyId))) {
      return res.status(404).json({
        success: false,
        message: "Property not found or unavailable",
      });
    }

    const [likeCount, commentCount, propertyViewCount, videoViewCount, liked] =
      await Promise.all([
        prisma.propertyLike.count({ where: { propertyId } }),
        prisma.propertyComment.count({ where: { propertyId } }),
        prisma.propertyView.count({
          where: { propertyId, viewType: "PROPERTY" },
        }),
        prisma.propertyView.count({
          where: { propertyId, viewType: "VIDEO" },
        }),
        prisma.propertyLike.findUnique({
          where: { userId_propertyId: { userId, propertyId } },
          select: { id: true },
        }),
      ]);

    return res.json({
      success: true,
      data: {
        propertyId,
        likeCount,
        commentCount,
        propertyViewCount,
        videoViewCount,
        isLiked: Boolean(liked),
      },
    });
  } catch (error) {
    console.error("Engagement summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load engagement",
    });
  }
}

export async function likeProperty(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = userIdOf(req);
    const propertyId = propertyIdOf(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!(await propertyExists(propertyId))) {
      return res.status(404).json({
        success: false,
        message: "Property not found or unavailable",
      });
    }

    await prisma.propertyLike.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      create: { userId, propertyId },
      update: {},
    });

    const likeCount = await prisma.propertyLike.count({
      where: { propertyId },
    });

    return res.json({
      success: true,
      data: { propertyId, isLiked: true, likeCount },
    });
  } catch (error) {
    console.error("Like property error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to like property",
    });
  }
}

export async function unlikeProperty(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = userIdOf(req);
    const propertyId = propertyIdOf(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!(await propertyExists(propertyId))) {
      return res.status(404).json({
        success: false,
        message: "Property not found or unavailable",
      });
    }

    await prisma.propertyLike.deleteMany({
      where: { userId, propertyId },
    });

    const likeCount = await prisma.propertyLike.count({
      where: { propertyId },
    });

    return res.json({
      success: true,
      data: { propertyId, isLiked: false, likeCount },
    });
  } catch (error) {
    console.error("Unlike property error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unlike property",
    });
  }
}

export async function getPropertyComments(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = userIdOf(req);
    const propertyId = propertyIdOf(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!(await propertyExists(propertyId))) {
      return res.status(404).json({
        success: false,
        message: "Property not found or unavailable",
      });
    }

    const requestedPage = Number.parseInt(
      String(req.query.page ?? "1"),
      10,
    );
    const page = Number.isFinite(requestedPage)
      ? Math.max(1, requestedPage)
      : 1;
    const pageSize = 20;

    const [comments, total] = await Promise.all([
      prisma.propertyComment.findMany({
        where: { propertyId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          propertyId: true,
          body: true,
          createdAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.propertyComment.count({ where: { propertyId } }),
    ]);

    return res.json({
      success: true,
      data: comments,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get property comments error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load comments",
    });
  }
}

export async function addPropertyComment(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = userIdOf(req);
    const propertyId = propertyIdOf(req);
    const body =
      typeof req.body?.body === "string" ? req.body.body.trim() : "";

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!body) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required",
      });
    }

    if (body.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Comment must be 1000 characters or fewer",
      });
    }

    if (!(await propertyExists(propertyId))) {
      return res.status(404).json({
        success: false,
        message: "Property not found or unavailable",
      });
    }

    const comment = await prisma.propertyComment.create({
      data: { userId, propertyId, body },
      select: {
        id: true,
        propertyId: true,
        body: true,
        createdAt: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Comment added",
      data: comment,
    });
  } catch (error) {
    console.error("Add property comment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add comment",
    });
  }
}

async function recordView(
  req: AuthenticatedRequest,
  res: Response,
  viewType: "PROPERTY" | "VIDEO",
) {
  const userId = userIdOf(req);
  const propertyId = propertyIdOf(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      ...visibleProperty,
      ...(viewType === "VIDEO"
        ? { videoUrl: { not: null } }
        : {}),
    },
    select: {
      id: true,
      videoUrl: true,
    },
  });

  if (
    !property ||
    (viewType === "VIDEO" && !property.videoUrl?.trim())
  ) {
    return res.status(404).json({
      success: false,
      message:
        viewType === "VIDEO"
          ? "Property video not found or unavailable"
          : "Property not found or unavailable",
    });
  }

  await prisma.propertyView.upsert({
    where: {
      userId_propertyId_viewType_viewDate: {
        userId,
        propertyId,
        viewType,
        viewDate: utcDate(),
      },
    },
    create: {
      userId,
      propertyId,
      viewType,
      viewDate: utcDate(),
    },
    update: {},
  });

  const viewCount = await prisma.propertyView.count({
    where: { propertyId, viewType },
  });

  return res.json({
    success: true,
    data: { propertyId, viewType, viewCount },
  });
}

export async function recordPropertyView(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    return await recordView(req, res, "PROPERTY");
  } catch (error) {
    console.error("Record property view error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record property view",
    });
  }
}

export async function recordVideoView(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    return await recordView(req, res, "VIDEO");
  } catch (error) {
    console.error("Record video view error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record video view",
    });
  }
}
