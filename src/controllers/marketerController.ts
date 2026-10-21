import type { Response } from "express";
import bcrypt from "bcryptjs";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

/**
 * ============================================================
 * CREATE MARKETER
 *
 * POST /api/admin/marketers
 *
 * Creates:
 * 1. User with role MARKETER
 * 2. Marketer profile
 * 3. MarketerCoverage
 *
 * New marketers are INACTIVE until approved.
 *
 * Expected body:
 * {
 *   firstName: string,
 *   lastName: string,
 *   email: string,
 *   phone?: string,
 *   password: string,
 *   notes?: string,
 *   countyId: string,
 *   constituencyId: string,
 *   wardIds: string[]
 * }
 *
 * Geography:
 * countyId       = County database ID
 * constituencyId = Constituency ID
 * wardIds        = Ward IDs
 *
 * A marketer may cover:
 * - exactly 1 county
 * - exactly 1 constituency
 * - 1 or 2 wards within that constituency
 * ============================================================
 */

export async function createMarketer(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      notes,
      countyId,
      constituencyId,
      wardIds,
    } = req.body;

    const normalizedFirstName = normalizeString(firstName);
    const normalizedLastName = normalizeString(lastName);
    const normalizedEmail = normalizeString(email).toLowerCase();
    const normalizedPhone = normalizeString(phone);
    const normalizedPassword =
      typeof password === "string" ? password : "";
    const normalizedNotes = normalizeString(notes);
    const normalizedCountyId = normalizeString(countyId);
    const normalizedConstituencyId = normalizeString(constituencyId);
    const normalizedWardIds = normalizeStringArray(wardIds);

    /**
     * --------------------------------------------------------
     * BASIC VALIDATION
     * --------------------------------------------------------
     */

    if (!normalizedFirstName) {
      return res.status(400).json({
        success: false,
        message: "First name is required",
      });
    }

    if (!normalizedLastName) {
      return res.status(400).json({
        success: false,
        message: "Last name is required",
      });
    }

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!normalizedPassword) {
      return res.status(400).json({
        success: false,
        message: "Temporary password is required",
      });
    }

    if (normalizedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Temporary password must contain at least 6 characters",
      });
    }

    /**
     * --------------------------------------------------------
     * COVERAGE VALIDATION
     * --------------------------------------------------------
     */

    if (!normalizedCountyId) {
      return res.status(400).json({
        success: false,
        message: "County is required",
      });
    }

    if (!normalizedConstituencyId) {
      return res.status(400).json({
        success: false,
        message: "Constituency is required",
      });
    }

    if (normalizedWardIds.length < 1) {
      return res.status(400).json({
        success: false,
        message: "At least one ward is required",
      });
    }

    if (normalizedWardIds.length > 2) {
      return res.status(400).json({
        success: false,
        message: "A marketer can cover a maximum of two wards",
      });
    }

    /**
     * --------------------------------------------------------
     * VERIFY COUNTY
     * --------------------------------------------------------
     */

    const county = await prisma.county.findUnique({
      where: {
        id: normalizedCountyId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!county) {
      return res.status(400).json({
        success: false,
        message: "Selected county does not exist",
      });
    }

    /**
     * --------------------------------------------------------
     * VERIFY CONSTITUENCY
     *
     * Constituency IDs in the imported Kenya geography use
     * the source IDs such as KE012056.
     * --------------------------------------------------------
     */

    const constituency = await prisma.constituency.findUnique({
      where: {
        id: normalizedConstituencyId,
      },
      select: {
        id: true,
        name: true,
        countyId: true,
      },
    });

    if (!constituency) {
      return res.status(400).json({
        success: false,
        message: "Selected constituency does not exist",
      });
    }

    if (constituency.countyId !== normalizedCountyId) {
      return res.status(400).json({
        success: false,
        message:
          "The selected constituency does not belong to the selected county",
      });
    }

    /**
     * --------------------------------------------------------
     * VERIFY WARDS
     *
     * Every selected ward must:
     * - exist
     * - belong to the selected constituency
     * --------------------------------------------------------
     */

    const wards = await prisma.ward.findMany({
      where: {
        id: {
          in: normalizedWardIds,
        },
      },
      select: {
        id: true,
        name: true,
        constituencyId: true,
      },
    });

    if (wards.length !== normalizedWardIds.length) {
      const foundIds = new Set(wards.map((ward) => ward.id));

      const missingWardIds = normalizedWardIds.filter(
        (id) => !foundIds.has(id)
      );

      return res.status(400).json({
        success: false,
        message: "One or more selected wards do not exist",
        data: {
          missingWardIds,
        },
      });
    }

    const invalidWardIds = wards
      .filter(
        (ward) =>
          ward.constituencyId !== normalizedConstituencyId
      )
      .map((ward) => ward.id);

    if (invalidWardIds.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected wards do not belong to the selected constituency",
        data: {
          invalidWardIds,
        },
      });
    }

    /**
     * --------------------------------------------------------
     * CHECK EMAIL DUPLICATE
     * --------------------------------------------------------
     */

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    /**
     * --------------------------------------------------------
     * CHECK PHONE DUPLICATE
     * --------------------------------------------------------
     */

    if (normalizedPhone) {
      const existingPhone = await prisma.user.findUnique({
        where: {
          phone: normalizedPhone,
        },
      });

      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message:
            "A user with this phone number already exists",
        });
      }
    }

    /**
     * --------------------------------------------------------
     * CHECK COVERAGE CONFLICT
     *
     * A ward should not be assigned to multiple marketers
     * within the same constituency.
     *
     * Because wardIds are stored as a String[] in
     * MarketerCoverage, we retrieve relevant coverage rows
     * and check the selected wards explicitly.
     * --------------------------------------------------------
     */

    const existingCoverages =
      await prisma.marketerCoverage.findMany({
        where: {
          countyId: normalizedCountyId,
          constituencyId: normalizedConstituencyId,
        },
        select: {
          id: true,
          marketerId: true,
          wardIds: true,
          marketer: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });

    const conflictingCoverage = existingCoverages.find(
      (coverage) =>
        coverage.wardIds.some((wardId) =>
          normalizedWardIds.includes(wardId)
        )
    );

    if (conflictingCoverage) {
      const conflictingWardIds =
        conflictingCoverage.wardIds.filter((wardId) =>
          normalizedWardIds.includes(wardId)
        );

      return res.status(409).json({
        success: false,
        message:
          "One or more selected wards are already assigned to another marketer",
        data: {
          conflictingWardIds,
          marketer: {
            id: conflictingCoverage.marketerId,
            name: `${conflictingCoverage.marketer.user.firstName} ${conflictingCoverage.marketer.user.lastName}`,
            email: conflictingCoverage.marketer.user.email,
            isActive:
              conflictingCoverage.marketer.user.isActive,
          },
        },
      });
    }

    /**
     * --------------------------------------------------------
     * HASH PASSWORD
     * --------------------------------------------------------
     */

    const hashedPassword = await bcrypt.hash(
      normalizedPassword,
      12
    );

    /**
     * --------------------------------------------------------
     * CREATE USER + MARKETER + COVERAGE
     *
     * The marketer remains inactive until the admin approves
     * the account.
     * --------------------------------------------------------
     */

    const marketer = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          email: normalizedEmail,
          phone: normalizedPhone || null,
          password: hashedPassword,
          role: "MARKETER",
          accountStatus: "INACTIVE",
          isActive: false,
        },
      });

      const marketerProfile = await tx.marketer.create({
        data: {
          userId: user.id,
          notes:
            normalizedNotes ||
            "Account created directly by administrator.",
        },
      });

      const coverage = await tx.marketerCoverage.create({
        data: {
          marketerId: marketerProfile.id,
          countyId: normalizedCountyId,
          constituencyId: normalizedConstituencyId,
          wardIds: normalizedWardIds,
        },
        include: {
          county: {
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
        },
      });

      return {
        ...marketerProfile,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        coverage,
      };
    });

    return res.status(201).json({
      success: true,
      message:
        "Marketer created successfully and is pending approval",
      data: {
        marketer,
      },
    });
  } catch (error) {
    console.error("Create marketer error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create marketer";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * ============================================================
 * LIST MARKETERS
 *
 * GET /api/admin/marketers
 *
 * Returns real marketers and their coverage.
 * ============================================================
 */

export async function getMarketers(
  _req: AuthenticatedRequest,
  res: Response
) {
  try {
    const marketers = await prisma.marketer.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            accountStatus: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },

        coverage: {
          include: {
            county: {
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
          },
        },

        _count: {
          select: {
            properties: true,
            viewings: true,
            places: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        marketers,
        count: marketers.length,
      },
    });
  } catch (error) {
    console.error("Get marketers error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to retrieve marketers";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * ============================================================
 * GET SINGLE MARKETER
 *
 * GET /api/admin/marketers/:id
 * ============================================================
 */

export async function getMarketer(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id = String(req.params.id);

    const marketer = await prisma.marketer.findUnique({
      where: {
        id,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            accountStatus: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },

        coverage: {
          include: {
            county: {
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
          },
        },

        application: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            idType: true,
            idNumber: true,
            idVerificationStatus: true,
            idVerificationDecision: true,
            idVerificationMessage: true,
            idVerifiedAt: true,
            countyId: true,
            constituencyId: true,
            wardIds: true,
            placeIds: true,
            hasRealEstateExperience: true,
            experienceAreas: true,
            experienceDuration: true,
            experienceDescription: true,
            currentOccupation: true,
            workingWithAnotherAgency: true,
            currentAgencyName: true,
            motivation: true,
            contribution: true,
            expectedPropertiesPerMonth: true,
            propertySources: true,
            knowsLandlords: true,
            approximateLandlordCount: true,
            comfortableCommunicating: true,
            communicationMethods: true,
            timeAvailability: true,
            willingToFollowProcedures: true,
            referenceName: true,
            referencePhone: true,
            referenceRelationship: true,
            declarationAccepted: true,
            marketerId: true,
          },
        },

        properties: {
          orderBy: {
            createdAt: "desc",
          },
        },

        viewings: {
          orderBy: {
            createdAt: "desc",
          },
        },

        _count: {
          select: {
            properties: true,
            viewings: true,
            places: true,
          },
        },
      },
    });

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Marketer not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        marketer,
      },
    });
  } catch (error) {
    console.error("Get marketer error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to retrieve marketer";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * ============================================================
 * UPDATE MARKETER
 *
 * PATCH /api/admin/marketers/:id
 *
 * Updates the marketer's editable account/profile information.
 *
 * Expected body:
 * {
 *   firstName?: string,
 *   lastName?: string,
 *   email?: string,
 *   phone?: string,
 *   notes?: string
 * }
 *
 * Coverage is intentionally not changed here.
 * Coverage is managed separately through:
 * County -> Constituency -> Ward(s)
 * ============================================================
 */

export async function updateMarketer(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id = String(req.params.id);

    const {
      firstName,
      lastName,
      email,
      phone,
      notes,
    } = req.body;

    const marketer = await prisma.marketer.findUnique({
      where: {
        id,
      },
      include: {
        user: true,
      },
    });

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Marketer not found",
      });
    }

    if (marketer.user.role !== "MARKETER") {
      return res.status(400).json({
        success: false,
        message: "This account is not a marketer account",
      });
    }

    const normalizedFirstName =
      firstName === undefined
        ? marketer.user.firstName
        : normalizeString(firstName);

    const normalizedLastName =
      lastName === undefined
        ? marketer.user.lastName
        : normalizeString(lastName);

    const normalizedEmail =
      email === undefined
        ? marketer.user.email
        : normalizeString(email).toLowerCase();

    const normalizedPhone =
      phone === undefined
        ? marketer.user.phone
        : normalizeString(phone);

    const normalizedNotes =
      notes === undefined
        ? marketer.notes
        : normalizeString(notes);

    if (!normalizedFirstName) {
      return res.status(400).json({
        success: false,
        message: "First name is required",
      });
    }

    if (!normalizedLastName) {
      return res.status(400).json({
        success: false,
        message: "Last name is required",
      });
    }

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const existingEmail = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        NOT: {
          id: marketer.userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    if (normalizedPhone) {
      const existingPhone = await prisma.user.findFirst({
        where: {
          phone: normalizedPhone,
          NOT: {
            id: marketer.userId,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message:
            "A user with this phone number already exists",
        });
      }
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.update({
          where: {
            id: marketer.userId,
          },
          data: {
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            email: normalizedEmail,
            phone: normalizedPhone || null,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            accountStatus: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        const updatedMarketer =
          await tx.marketer.update({
            where: {
              id,
            },
            data: {
              notes: normalizedNotes,
            },
            include: {
              coverage: {
                include: {
                  county: {
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
                },
              },
            },
          });

        return {
          ...updatedMarketer,
          user,
        };
      }
    );

    return res.status(200).json({
      success: true,
      message: "Marketer updated successfully",
      data: {
        marketer: updated,
      },
    });
  } catch (error) {
    console.error("Update marketer error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to update marketer";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * ============================================================
 * APPROVE MARKETER
 *
 * PATCH /api/admin/marketers/:id/approve
 *
 * Activates the marketer's User account.
 * ============================================================
 */

export async function approveMarketer(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id = String(req.params.id);

    const marketer = await prisma.marketer.findUnique({
      where: {
        id,
      },
      include: {
        coverage: true,
      },
    });

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Marketer not found",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: marketer.userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Marketer user account not found",
      });
    }

    if (user.role !== "MARKETER") {
      return res.status(400).json({
        success: false,
        message:
          "This account is not a marketer account",
      });
    }

    if (user.isActive) {
      return res.status(400).json({
        success: false,
        message: "Marketer is already active",
      });
    }

    /**
     * A directly-created marketer should have coverage before
     * approval because the marketer property system depends on it.
     */
    if (!marketer.coverage) {
      return res.status(400).json({
        success: false,
        message:
          "This marketer cannot be approved because no coverage has been assigned",
      });
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: marketer.userId,
      },
      data: {
        accountStatus: "ACTIVE",
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Marketer approved successfully",
      data: {
        user: updatedUser,
        marketerId: marketer.id,
        coverage: marketer.coverage,
      },
    });
  } catch (error) {
    console.error("Approve marketer error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to approve marketer";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * ============================================================
 * DEACTIVATE MARKETER
 *
 * PATCH /api/admin/marketers/:id/deactivate
 * ============================================================
 */

export async function deactivateMarketer(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id = String(req.params.id);

    const marketer = await prisma.marketer.findUnique({
      where: {
        id,
      },
    });

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Marketer not found",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: marketer.userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Marketer user account not found",
      });
    }

    if (user.role !== "MARKETER") {
      return res.status(400).json({
        success: false,
        message:
          "This account is not a marketer account",
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: "Marketer is already inactive",
      });
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: marketer.userId,
      },
      data: {
        accountStatus: "INACTIVE",
        isActive: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Marketer deactivated successfully",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error("Deactivate marketer error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to deactivate marketer";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * ============================================================
 * LEGACY PLACES ENDPOINTS
 *
 * These are retained temporarily so the existing
 * marketerRoutes.ts continues to compile.
 *
 * NEW CODE SHOULD NOT USE THESE.
 *
 * The active marketer/property system uses MarketerCoverage:
 * County → Constituency → Ward(s)
 *
 * We will remove these endpoints from marketerRoutes.ts after
 * the Admin Marketers frontend has been migrated.
 * ============================================================
 */

/**
 * GET MARKETER PLACES
 *
 * GET /api/admin/marketers/:id/places
 *
 * @deprecated Use MarketerCoverage instead.
 */
export async function getMarketerPlaces(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const marketerId = String(req.params.id);

    const marketer = await prisma.marketer.findUnique({
      where: {
        id: marketerId,
      },
      select: {
        id: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        places: {
          orderBy: {
            assignedAt: "asc",
          },
          include: {
            place: {
              include: {
                county: true,
              },
            },
          },
        },
      },
    });

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Marketer not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        marketerId: marketer.id,
        marketerName: `${marketer.user.firstName} ${marketer.user.lastName}`,
        places: marketer.places,
      },
    });
  } catch (error) {
    console.error("Get marketer places error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve marketer places",
    });
  }
}

/**
 * ASSIGN PLACES TO MARKETER
 *
 * POST /api/admin/marketers/:id/places
 *
 * @deprecated Use MarketerCoverage instead.
 */
export async function assignMarketerPlaces(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const marketerId = String(req.params.id);
    const { placeIds } = req.body;

    if (!Array.isArray(placeIds)) {
      return res.status(400).json({
        success: false,
        message: "placeIds must be an array",
      });
    }

    const normalizedPlaceIds = normalizeStringArray(
      placeIds
    );

    if (normalizedPlaceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one place is required",
      });
    }

    const marketer = await prisma.marketer.findUnique({
      where: {
        id: marketerId,
      },
    });

    if (!marketer) {
      return res.status(404).json({
        success: false,
        message: "Marketer not found",
      });
    }

    const places = await prisma.place.findMany({
      where: {
        id: {
          in: normalizedPlaceIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (places.length !== normalizedPlaceIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected places do not exist",
      });
    }

    await prisma.marketerPlace.createMany({
      data: normalizedPlaceIds.map((placeId) => ({
        marketerId,
        placeId,
      })),
      skipDuplicates: true,
    });

    const assignments =
      await prisma.marketerPlace.findMany({
        where: {
          marketerId,
        },
        orderBy: {
          assignedAt: "asc",
        },
        include: {
          place: {
            include: {
              county: true,
            },
          },
        },
      });

    return res.status(200).json({
      success: true,
      message: "Places assigned successfully",
      data: {
        assignments,
      },
    });
  } catch (error) {
    console.error(
      "Assign marketer places error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to assign marketer places";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

/**
 * REMOVE PLACE FROM MARKETER
 *
 * DELETE /api/admin/marketers/:id/places/:placeId
 *
 * @deprecated Use MarketerCoverage instead.
 */
export async function removeMarketerPlace(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const marketerId = String(req.params.id);
    const placeId = String(req.params.placeId);

    const assignment =
      await prisma.marketerPlace.findUnique({
        where: {
          marketerId_placeId: {
            marketerId,
            placeId,
          },
        },
      });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message:
          "This place is not assigned to the marketer",
      });
    }

    await prisma.marketerPlace.delete({
      where: {
        marketerId_placeId: {
          marketerId,
          placeId,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Place removed from marketer successfully",
    });
  } catch (error) {
    console.error(
      "Remove marketer place error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to remove marketer place",
    });
  }
}
