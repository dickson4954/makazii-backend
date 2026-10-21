import { Request, Response } from "express";
import prisma from "../config/prisma";
import { PropertyStatus, PropertyType } from "@prisma/client";

type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    role: string;
    email: string;
  };
};

const ALLOWED_MARKETER_STATUSES: PropertyStatus[] = [
  PropertyStatus.DRAFT,
  PropertyStatus.PENDING_VERIFICATION,
  PropertyStatus.CHANGES_REQUIRED,
];

const PROPERTY_TYPES: PropertyType[] = [
  PropertyType.SINGLE_ROOM,
  PropertyType.BEDSITTER,
  PropertyType.ONE_BEDROOM,
  PropertyType.TWO_BEDROOM,
  PropertyType.THREE_BEDROOM,
];

function getAuthenticatedUserId(req: AuthenticatedRequest): string | null {
  return req.user?.userId ?? null;
}

function parsePositiveInteger(
  value: unknown,
  fieldName: string,
  required = false,
): number | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }

    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  return parsed;
}

function parseBoolean(
  value: unknown,
  fieldName: string,
  defaultValue?: boolean,
): boolean | undefined {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  throw new Error(`${fieldName} must be true or false`);
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function getMarketerFromUser(userId: string) {
  return prisma.marketer.findUnique({
    where: {
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      },
      coverage: {
        include: {
          county: true,
          constituency: true,
        },
      },
    },
  });
}

async function validateMarketerCoverage(
  marketerId: string,
  countyId: string,
  constituencyId: string,
  wardId: string,
) {
  const coverage = await prisma.marketerCoverage.findUnique({
    where: {
      marketerId,
    },
  });

  if (!coverage) {
    throw new Error(
      "This marketer does not have an approved coverage area.",
    );
  }

  if (coverage.countyId !== countyId) {
    throw new Error(
      "This property is outside the marketer's approved county coverage.",
    );
  }

  if (coverage.constituencyId !== constituencyId) {
    throw new Error(
      "This property is outside the marketer's approved constituency coverage.",
    );
  }

  if (!coverage.wardIds.includes(wardId)) {
    throw new Error(
      "This property is outside the marketer's approved ward coverage.",
    );
  }

  return coverage;
}

async function validateGeography(
  countyId: string,
  constituencyId: string,
  wardId: string,
) {
  const county = await prisma.county.findUnique({
    where: {
      id: countyId,
    },
  });

  if (!county) {
    throw new Error("Selected county was not found.");
  }

  const constituency = await prisma.constituency.findUnique({
    where: {
      id: constituencyId,
    },
  });

  if (!constituency) {
    throw new Error("Selected constituency was not found.");
  }

  if (constituency.countyId !== countyId) {
    throw new Error(
      "The selected constituency does not belong to the selected county.",
    );
  }

  const ward = await prisma.ward.findUnique({
    where: {
      id: wardId,
    },
  });

  if (!ward) {
    throw new Error("Selected ward was not found.");
  }

  if (ward.constituencyId !== constituencyId) {
    throw new Error(
      "The selected ward does not belong to the selected constituency.",
    );
  }

  return {
    county,
    constituency,
    ward,
  };
}

async function validateAmenities(amenityIds: string[]) {
  if (amenityIds.length === 0) {
    return [];
  }

  const amenities = await prisma.amenity.findMany({
    where: {
      id: {
        in: amenityIds,
      },
    },
  });

  const foundIds = new Set(amenities.map((amenity) => amenity.id));

  const missingIds = amenityIds.filter(
    (id) => !foundIds.has(id),
  );

  if (missingIds.length > 0) {
    throw new Error(
      `One or more selected amenities were not found: ${missingIds.join(", ")}`,
    );
  }

  return amenities;
}

/**
 * GET /api/marketer/properties
 *
 * Returns only properties belonging to the authenticated marketer.
 */
export async function getMarketerProperties(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const marketer = await getMarketerFromUser(userId);

    if (!marketer) {
      return res.status(403).json({
        success: false,
        message: "Marketer profile not found.",
      });
    }

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : "";

    const where: any = {
      marketerId: marketer.id,
    };

    if (status) {
      if (!Object.values(PropertyStatus).includes(status as PropertyStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid property status: ${status}`,
        });
      }

      where.status = status as PropertyStatus;
    }

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          county: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const properties = await prisma.property.findMany({
      where,
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        countyRelation: true,
        constituency: true,
        ward: true,
        images: {
          orderBy: {
            createdAt: "asc",
          },
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
        statusHistory: {
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            viewingRequests: true,
            shortlists: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: properties,
      count: properties.length,
    });
  } catch (error) {
    console.error("getMarketerProperties error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load marketer properties.",
    });
  }
}

/**
 * GET /api/marketer/properties/:id
 *
 * Returns one property, but only when it belongs to the authenticated marketer.
 */
export async function getMarketerProperty(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const marketer = await getMarketerFromUser(userId);

    if (!marketer) {
      return res.status(403).json({
        success: false,
        message: "Marketer profile not found.",
      });
    }

    const property = await prisma.property.findFirst({
      where: {
        id: String(req.params.id),
        marketerId: marketer.id,
      },
      include: {
        countyRelation: true,
        constituency: true,
        ward: true,
        images: {
          orderBy: {
            createdAt: "asc",
          },
        },
        amenities: {
          include: {
            amenity: true,
          },
        },
        statusHistory: {
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            viewingRequests: true,
            shortlists: true,
          },
        },
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    return res.json({
      success: true,
      data: property,
    });
  } catch (error) {
    console.error("getMarketerProperty error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load property.",
    });
  }
}

/**
 * POST /api/marketer/properties
 *
 * Creates a new property for the authenticated marketer.
 */
export async function createMarketerProperty(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const marketer = await getMarketerFromUser(userId);

    if (!marketer) {
      return res.status(403).json({
        success: false,
        message: "Marketer profile not found.",
      });
    }

    if (!marketer.user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This marketer account is inactive.",
      });
    }

    const title = normalizeString(req.body.title);
    const description = normalizeString(req.body.description);

    const propertyType =
      normalizeString(req.body.propertyType)?.toUpperCase() as
        | PropertyType
        | undefined;

    const countyId = normalizeString(req.body.countyId);
    const constituencyId = normalizeString(req.body.constituencyId);
    const wardId = normalizeString(req.body.wardId);

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Property title is required.",
      });
    }

    if (title.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Property title must be at least 3 characters.",
      });
    }

    if (!propertyType || !PROPERTY_TYPES.includes(propertyType)) {
      return res.status(400).json({
        success: false,
        message: "A valid property type is required.",
      });
    }

    if (!countyId || !constituencyId || !wardId) {
      return res.status(400).json({
        success: false,
        message:
          "County, constituency and ward are all required.",
      });
    }

    const rent = parsePositiveInteger(
      req.body.rent,
      "rent",
      true,
    );

    const viewingFee = parsePositiveInteger(
      req.body.viewingFee,
      "viewingFee",
    );

    const deposit = parsePositiveInteger(
      req.body.deposit,
      "deposit",
    );

    const bedrooms = parsePositiveInteger(
      req.body.bedrooms,
      "bedrooms",
    );

    const bathrooms = parsePositiveInteger(
      req.body.bathrooms,
      "bathrooms",
    );

    if (rent === undefined || rent <= 0) {
      return res.status(400).json({
        success: false,
        message: "Monthly rent must be greater than zero.",
      });
    }

    if (viewingFee !== undefined && viewingFee < 0) {
      return res.status(400).json({
        success: false,
        message: "Viewing fee cannot be negative.",
      });
    }

    if (deposit !== undefined && deposit < 0) {
      return res.status(400).json({
        success: false,
        message: "Deposit cannot be negative.",
      });
    }

    if (bedrooms !== undefined && bedrooms < 0) {
      return res.status(400).json({
        success: false,
        message: "Bedrooms cannot be negative.",
      });
    }

    if (bathrooms !== undefined && bathrooms < 0) {
      return res.status(400).json({
        success: false,
        message: "Bathrooms cannot be negative.",
      });
    }

    const geography = await validateGeography(
      countyId,
      constituencyId,
      wardId,
    );

    await validateMarketerCoverage(
      marketer.id,
      countyId,
      constituencyId,
      wardId,
    );

    const amenityIds = normalizeStringArray(
      req.body.amenityIds,
    );

    await validateAmenities(amenityIds);

    const available = parseBoolean(
      req.body.available,
      "available",
      true,
    );

    const property = await prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          title,
          description,
          propertyType,
          status: PropertyStatus.DRAFT,
          rent,
          viewingFee,
          deposit,

          countyId,
          constituencyId,
          wardId,

          // Legacy compatibility fields.
          county: geography.county.name,
          town: "",
          area: "",
          placeId: null,

          latitude: null,
          longitude: null,

          bedrooms,
          bathrooms,

          available,
          verified: false,

          marketerId: marketer.id,

          amenities: {
            create: amenityIds.map((amenityId) => ({
              amenityId,
            })),
          },

          statusHistory: {
            create: {
              status: PropertyStatus.DRAFT,
              note: "Property created by marketer",
            },
          },
        },
        include: {
          countyRelation: true,
          constituency: true,
          ward: true,
          images: true,
          amenities: {
            include: {
              amenity: true,
            },
          },
          statusHistory: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: "Property created successfully.",
      data: property,
    });
  } catch (error) {
    console.error("createMarketerProperty error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create property.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * PATCH /api/marketer/properties/:id
 *
 * Updates an owned property.
 *
 * Marketers cannot use this endpoint to publish/activate a property.
 */
export async function updateMarketerProperty(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const marketer = await getMarketerFromUser(userId);

    if (!marketer) {
      return res.status(403).json({
        success: false,
        message: "Marketer profile not found.",
      });
    }

    const existing = await prisma.property.findFirst({
      where: {
        id: String(req.params.id),
        marketerId: marketer.id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    if (existing.status === PropertyStatus.RENTED) {
      return res.status(400).json({
        success: false,
        message:
          "A rented property is locked and cannot be edited.",
      });
    }

    const title =
      req.body.title !== undefined
        ? normalizeString(req.body.title)
        : undefined;

    const description =
      req.body.description !== undefined
        ? normalizeString(req.body.description)
        : undefined;

    const propertyType =
      req.body.propertyType !== undefined
        ? (normalizeString(req.body.propertyType)?.toUpperCase() as
            | PropertyType
            | undefined)
        : undefined;

    const countyId =
      req.body.countyId !== undefined
        ? normalizeString(req.body.countyId)
        : existing.countyId;

    const constituencyId =
      req.body.constituencyId !== undefined
        ? normalizeString(req.body.constituencyId)
        : existing.constituencyId;

    const wardId =
      req.body.wardId !== undefined
        ? normalizeString(req.body.wardId)
        : existing.wardId;

    if (title !== undefined && title.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Property title must be at least 3 characters.",
      });
    }

    if (
      propertyType !== undefined &&
      !PROPERTY_TYPES.includes(propertyType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid property type.",
      });
    }

    if (!countyId || !constituencyId || !wardId) {
      return res.status(400).json({
        success: false,
        message:
          "County, constituency and ward are all required.",
      });
    }

    const rent =
      req.body.rent !== undefined
        ? parsePositiveInteger(req.body.rent, "rent", true)
        : existing.rent;

    const viewingFee =
      req.body.viewingFee !== undefined
        ? parsePositiveInteger(
            req.body.viewingFee,
            "viewingFee",
          )
        : existing.viewingFee;

    const deposit =
      req.body.deposit !== undefined
        ? parsePositiveInteger(req.body.deposit, "deposit")
        : existing.deposit;

    const bedrooms =
      req.body.bedrooms !== undefined
        ? parsePositiveInteger(req.body.bedrooms, "bedrooms")
        : existing.bedrooms;

    const bathrooms =
      req.body.bathrooms !== undefined
        ? parsePositiveInteger(
            req.body.bathrooms,
            "bathrooms",
          )
        : existing.bathrooms;

    if (rent === undefined || rent <= 0) {
      return res.status(400).json({
        success: false,
        message: "Monthly rent must be greater than zero.",
      });
    }

    const geographyChanged =
      countyId !== existing.countyId ||
      constituencyId !== existing.constituencyId ||
      wardId !== existing.wardId;

    const geography = geographyChanged
      ? await validateGeography(
          countyId,
          constituencyId,
          wardId,
        )
      : null;

    await validateMarketerCoverage(
      marketer.id,
      countyId,
      constituencyId,
      wardId,
    );

    let amenityIds: string[] | undefined;

    if (req.body.amenityIds !== undefined) {
      amenityIds = normalizeStringArray(
        req.body.amenityIds,
      );

      await validateAmenities(amenityIds);
    }

    const available =
      req.body.available !== undefined
        ? parseBoolean(req.body.available, "available")
        : existing.available;

    const property = await prisma.$transaction(async (tx) => {
      if (amenityIds !== undefined) {
        await tx.propertyAmenity.deleteMany({
          where: {
            propertyId: existing.id,
          },
        });
      }

      const updated = await tx.property.update({
        where: {
          id: existing.id,
        },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(req.body.description !== undefined
            ? { description }
            : {}),
          ...(propertyType !== undefined
            ? { propertyType }
            : {}),

          rent,
          viewingFee,
          deposit,

          countyId,
          constituencyId,
          wardId,

          ...(geography
            ? {
                county: geography.county.name,
              }
            : {}),

          // Legacy compatibility values remain empty.
          town: "",
          area: "",
          placeId: null,
          latitude: null,
          longitude: null,

          bedrooms,
          bathrooms,

          available,

          ...(amenityIds !== undefined
            ? {
                amenities: {
                  create: amenityIds.map((amenityId) => ({
                    amenityId,
                  })),
                },
              }
            : {}),
        },
        include: {
          countyRelation: true,
          constituency: true,
          ward: true,
          images: {
            orderBy: {
              createdAt: "asc",
            },
          },
          amenities: {
            include: {
              amenity: true,
            },
          },
          statusHistory: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      return updated;
    });

    return res.json({
      success: true,
      message: "Property updated successfully.",
      data: property,
    });
  } catch (error) {
    console.error("updateMarketerProperty error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to update property.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * PATCH /api/marketer/properties/:id/status
 *
 * Marketer workflow:
 *
 * DRAFT -> PENDING_VERIFICATION
 * CHANGES_REQUIRED -> PENDING_VERIFICATION
 *
 * A marketer cannot activate/publish/reject a property.
 */
export async function updateMarketerPropertyStatus(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const marketer = await getMarketerFromUser(userId);

    if (!marketer) {
      return res.status(403).json({
        success: false,
        message: "Marketer profile not found.",
      });
    }

    const property = await prisma.property.findFirst({
      where: {
        id: String(req.params.id),
        marketerId: marketer.id,
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    if (property.status === PropertyStatus.RENTED) {
      return res.status(400).json({
        success: false,
        message:
          "A rented property cannot be moved to another status.",
      });
    }

    const requestedStatus = normalizeString(
      req.body.status,
    )?.toUpperCase() as PropertyStatus | undefined;

    if (!requestedStatus) {
      return res.status(400).json({
        success: false,
        message: "Property status is required.",
      });
    }

    if (!ALLOWED_MARKETER_STATUSES.includes(requestedStatus)) {
      return res.status(403).json({
        success: false,
        message:
          "Marketers cannot set this property status. Only draft, pending verification and changes required are allowed.",
      });
    }

    const validTransition =
      (property.status === PropertyStatus.DRAFT &&
        requestedStatus ===
          PropertyStatus.PENDING_VERIFICATION) ||
      (property.status ===
        PropertyStatus.CHANGES_REQUIRED &&
        requestedStatus ===
          PropertyStatus.PENDING_VERIFICATION) ||
      (property.status === requestedStatus);

    if (!validTransition) {
      return res.status(400).json({
        success: false,
        message: `Invalid marketer status transition from ${property.status} to ${requestedStatus}.`,
      });
    }

    const note =
      typeof req.body.note === "string"
        ? req.body.note.trim()
        : undefined;

    const updated = await prisma.$transaction(
      async (tx) => {
        const result = await tx.property.update({
          where: {
            id: property.id,
          },
          data: {
            status: requestedStatus,
            verified: false,
            available:
              requestedStatus ===
                PropertyStatus.PENDING_VERIFICATION
                ? property.available
                : property.available,
          },
          include: {
            countyRelation: true,
            constituency: true,
            ward: true,
            images: {
              orderBy: {
                createdAt: "asc",
              },
            },
            amenities: {
              include: {
                amenity: true,
              },
            },
            statusHistory: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        });

        if (property.status !== requestedStatus) {
          await tx.propertyStatusHistory.create({
            data: {
              propertyId: property.id,
              status: requestedStatus,
              note:
                note ||
                (requestedStatus ===
                PropertyStatus.PENDING_VERIFICATION
                  ? "Property submitted by marketer for verification"
                  : "Property status updated by marketer"),
            },
          });
        }

        return result;
      },
    );

    return res.json({
      success: true,
      message:
        requestedStatus ===
        PropertyStatus.PENDING_VERIFICATION
          ? "Property submitted for verification."
          : "Property status updated.",
      data: updated,
    });
  } catch (error) {
    console.error(
      "updateMarketerPropertyStatus error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to update property status.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

/**
 * PATCH /api/marketer/properties/:id/availability
 *
 * Marketer may change availability for their own property,
 * except when the property has already been marked RENTED.
 */
export async function updateMarketerPropertyAvailability(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const marketer = await getMarketerFromUser(userId);

    if (!marketer) {
      return res.status(403).json({
        success: false,
        message: "Marketer profile not found.",
      });
    }

    const property = await prisma.property.findFirst({
      where: {
        id: String(req.params.id),
        marketerId: marketer.id,
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    if (property.status === PropertyStatus.RENTED) {
      return res.status(400).json({
        success: false,
        message:
          "A rented property cannot be made available again.",
      });
    }

    const available = parseBoolean(
      req.body.available,
      "available",
    );

    if (available === undefined) {
      return res.status(400).json({
        success: false,
        message: "The available field is required.",
      });
    }

    const updated = await prisma.property.update({
      where: {
        id: property.id,
      },
      data: {
        available,
      },
    });

    return res.json({
      success: true,
      message: available
        ? "Property marked as available."
        : "Property marked as unavailable.",
      data: updated,
    });
  } catch (error) {
    console.error(
      "updateMarketerPropertyAvailability error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to update property availability.";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}
