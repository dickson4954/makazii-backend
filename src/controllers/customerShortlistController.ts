import type { Response } from "express";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

const customerPropertyWhere = {
  status: "ACTIVE" as const,
  available: true,
  verified: true,
};

export async function getCustomerShortlist(
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

    const shortlists = await prisma.shortlist.findMany({
      where: {
        userId,
        property: customerPropertyWhere,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        propertyId: true,
        createdAt: true,
      },
    });

    return res.json({
      success: true,
      data: shortlists,
    });
  } catch (error) {
    console.error(
      "Get customer shortlist error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load shortlist",
    });
  }
}

export async function addCustomerShortlist(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const propertyId = String(req.params.propertyId ?? "").trim();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        ...customerPropertyWhere,
      },
      select: {
        id: true,
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or unavailable",
      });
    }

    const shortlist = await prisma.shortlist.upsert({
      where: {
        userId_propertyId: {
          userId,
          propertyId,
        },
      },
      create: {
        userId,
        propertyId,
      },
      update: {},
      select: {
        id: true,
        propertyId: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Property added to shortlist",
      data: shortlist,
    });
  } catch (error) {
    console.error(
      "Add customer shortlist error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to add property to shortlist",
    });
  }
}

export async function removeCustomerShortlist(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const propertyId = String(req.params.propertyId ?? "").trim();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    await prisma.shortlist.deleteMany({
      where: {
        userId,
        propertyId,
      },
    });

    return res.json({
      success: true,
      message: "Property removed from shortlist",
    });
  } catch (error) {
    console.error(
      "Remove customer shortlist error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to remove property from shortlist",
    });
  }
}

export async function clearCustomerShortlist(
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

    const result = await prisma.shortlist.deleteMany({
      where: {
        userId,
      },
    });

    return res.json({
      success: true,
      message: "Shortlist cleared",
      data: {
        deletedCount: result.count,
      },
    });
  } catch (error) {
    console.error(
      "Clear customer shortlist error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to clear shortlist",
    });
  }
}
