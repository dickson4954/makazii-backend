import { Request, Response } from "express";
import prisma from "../config/prisma";

const getFullName = (user: {
  firstName: string;
  lastName: string;
}) => {
  return `${user.firstName} ${user.lastName}`.trim();
};

export const getCustomers = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const customers = await prisma.user.findMany({
      where: {
        role: "RENTER",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        accountStatus: true,
        statusReason: true,
        statusChangedAt: true,
        statusChangedById: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            shortlists: true,
            viewingRequests: true,
          },
        },
      },
    });

    res.json({
      success: true,
      customers: customers.map((customer) => ({
        id: customer.id,
        name: getFullName(customer),
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone ?? "",
        status: customer.accountStatus,
        statusReason: customer.statusReason,
        statusChangedAt: customer.statusChangedAt,
        statusChangedById: customer.statusChangedById,
        isActive: customer.isActive,
        emailVerified: Boolean(customer.emailVerifiedAt),
        emailVerifiedAt: customer.emailVerifiedAt,
        joined: customer.createdAt,
        updatedAt: customer.updatedAt,
        savedHomes: customer._count.shortlists,
        viewings: customer._count.viewingRequests,
      })),
    });
  } catch (error) {
    console.error("Get customers error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load customers.",
    });
  }
};

export const getCustomer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = String(req.params.id);

    const customer = await prisma.user.findFirst({
      where: {
        id,
        role: "RENTER",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        accountStatus: true,
        statusReason: true,
        statusChangedAt: true,
        statusChangedById: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!customer) {
      res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
      return;
    }

    const [savedHomes, viewings] = await Promise.all([
      prisma.shortlist.count({
        where: {
          userId: id,
        },
      }),
      prisma.viewingRequest.count({
        where: {
          renterId: id,
        },
      }),
    ]);

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: getFullName(customer),
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone ?? "",
        role: customer.role,
        status: customer.accountStatus,
        statusReason: customer.statusReason,
        statusChangedAt: customer.statusChangedAt,
        statusChangedById: customer.statusChangedById,
        isActive: customer.isActive,
        emailVerified: Boolean(customer.emailVerifiedAt),
        emailVerifiedAt: customer.emailVerifiedAt,
        joined: customer.createdAt,
        updatedAt: customer.updatedAt,
        savedHomes,
        viewings,
      },
    });
  } catch (error) {
    console.error("Get customer error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load customer.",
    });
  }
};

export const updateCustomerStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { status, reason } = req.body;

    const allowedStatuses = ["ACTIVE", "INACTIVE", "BLOCKED"];

    if (!allowedStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid account status.",
      });
      return;
    }

    const cleanReason =
      reason && String(reason).trim()
        ? String(reason).trim()
        : null;

    if (status === "BLOCKED" && !cleanReason) {
      res.status(400).json({
        success: false,
        message: "A reason is required when blocking a customer.",
      });
      return;
    }

    const customer = await prisma.user.findFirst({
      where: {
        id,
        role: "RENTER",
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
      return;
    }

    const newStatus = status as "ACTIVE" | "INACTIVE" | "BLOCKED";
    const isActive = newStatus === "ACTIVE";

    const changedById =
      (req as Request & {
        user?: {
          id?: string;
        };
      }).user?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: {
          id,
        },
        data: {
          accountStatus: newStatus,
          statusReason: cleanReason,
          statusChangedAt: new Date(),
          statusChangedById: changedById,
          isActive,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          accountStatus: true,
          statusReason: true,
          statusChangedAt: true,
          statusChangedById: true,
          isActive: true,
        },
      });

      const history = await tx.userStatusHistory.create({
        data: {
          userId: id,
          status: newStatus,
          reason: cleanReason,
          changedById,
        },
      });

      return {
        updatedUser,
        history,
      };
    });

    res.json({
      success: true,
      message: `Customer status changed to ${newStatus}.`,
      customer: {
        id: result.updatedUser.id,
        name: getFullName(result.updatedUser),
        firstName: result.updatedUser.firstName,
        lastName: result.updatedUser.lastName,
        email: result.updatedUser.email,
        phone: result.updatedUser.phone ?? "",
        status: result.updatedUser.accountStatus,
        statusReason: result.updatedUser.statusReason,
        statusChangedAt: result.updatedUser.statusChangedAt,
        statusChangedById: result.updatedUser.statusChangedById,
        isActive: result.updatedUser.isActive,
      },
      history: result.history,
    });
  } catch (error) {
    console.error("Update customer status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update customer status.",
    });
  }
};

export const getCustomerStatusHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = String(req.params.id);

    const customer = await prisma.user.findFirst({
      where: {
        id,
        role: "RENTER",
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
      return;
    }

    const history = await prisma.userStatusHistory.findMany({
      where: {
        userId: id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        reason: true,
        changedById: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Get customer status history error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load customer status history.",
    });
  }
};
