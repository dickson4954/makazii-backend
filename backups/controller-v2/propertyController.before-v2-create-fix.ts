import type { Request, Response } from "express";
import {
  PropertyStatus,
  PropertyType,
  ViewingStatus,
} from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * Get the authenticated admin's user ID.
 */
function getUserId(req: Request): string {
  const authenticatedReq = req as AuthenticatedRequest;

  if (!authenticatedReq.user?.userId) {
    throw new Error("Authenticated user not found");
  }

  return authenticatedReq.user.userId;
}

/**
 * Express params can be typed as string | string[].
 * Property IDs in MAKAZII must always be a single string.
 */
function getPropertyId(req: Request): string | null {
  const value = req.params.id;

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalNumber(
  value: unknown,
  fieldName: string
): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numberValue =
    typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  return numberValue;
}

function normalizeOptionalInteger(
  value: unknown,
  fieldName: string
): number | undefined {
  const numberValue = normalizeOptionalNumber(value, fieldName);

  if (numberValue === undefined) {
    return undefined;
  }

  if (!Number.isInteger(numberValue)) {
    throw new Error(`${fieldName} must be a whole number`);
  }

  return numberValue;
}

function isValidPropertyStatus(
  value: unknown
): value is PropertyStatus {
  return (
    typeof value === "string" &&
    Object.values(PropertyStatus).includes(value as PropertyStatus)
  );
}

function isValidPropertyType(
  value: unknown
): value is PropertyType {
  return (
    typeof value === "string" &&
    Object.values(PropertyType).includes(value as PropertyType)
  );
}

/**
 * Validate an optional array of image objects.
 */
function normalizeImages(value: unknown): Array<{
  url: string;
  publicId: string | null;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (image): image is Record<string, unknown> =>
        typeof image === "object" &&
        image !== null
    )
    .map((image, index) => {
      const url = normalizeString(image.url);

      if (!url) {
        return null;
      }

      const sortOrder =
        typeof image.sortOrder === "number" &&
        Number.isInteger(image.sortOrder)
          ? image.sortOrder
          : index;

      return {
        url,
        publicId:
          typeof image.publicId === "string"
            ? image.publicId.trim() || null
            : null,
        altText:
          typeof image.altText === "string"
            ? image.altText.trim() || null
            : null,
        sortOrder,
        isPrimary: Boolean(image.isPrimary),
      };
    })
    .filter(
      (
        image
      ): image is {
        url: string;
        publicId: string | null;
        altText: string | null;
        sortOrder: number;
        isPrimary: boolean;
      } => image !== null
    );
}

/**
 * Normalize amenity IDs.
 */
function normalizeAmenityIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(
          (id): id is string =>
            typeof id === "string" && id.trim().length > 0
        )
        .map((id) => id.trim())
    ),
  ];
}

/**
 * Validate that all supplied amenity IDs exist.
 *
 * Returns the IDs that were not found so the caller
 * can return a clear 400 response instead of allowing
 * a database foreign-key error.
 */
async function findMissingAmenityIds(
  amenityIds: string[]
): Promise<string[]> {
  if (amenityIds.length === 0) {
    return [];
  }

  const existingAmenities = await prisma.amenity.findMany({
    where: {
      id: {
        in: amenityIds,
      },
    },
    select: {
      id: true,
    },
  });

  const existingIds = new Set(
    existingAmenities.map((amenity) => amenity.id)
  );

  return amenityIds.filter(
    (amenityId) => !existingIds.has(amenityId)
  );
}

/**
 * GET /api/admin/properties
 *
 * Returns all properties for the admin properties index.
 */
export async function getAdminProperties(
  req: Request,
  res: Response
) {
  try {
    const search = normalizeString(req.query.search);
    const status = normalizeString(req.query.status);
    const county = normalizeString(req.query.county);
    const town = normalizeString(req.query.town);
    const area = normalizeString(req.query.area);

    const where: any = {};

    if (isValidPropertyStatus(status)) {
      where.status = status;
    }

    if (county) {
      where.county = {
        contains: county,
        mode: "insensitive",
      };
    }

    if (town) {
      where.town = {
        contains: town,
        mode: "insensitive",
      };
    }

    if (area) {
      where.area = {
        contains: area,
        mode: "insensitive",
      };
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
          description: {
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
        {
          town: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          area: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          id: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const properties = await prisma.property.findMany({
      where,
      include: {
        landlord: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                accountStatus: true,
                isActive: true,
              },
            },
          },
        },
        marketer: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                accountStatus: true,
                isActive: true,
              },
            },
          },
        },
        images: {
          orderBy: {
            sortOrder: "asc",
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
          take: 10,
        },
        _count: {
          select: {
            viewingRequests: true,
            shortlists: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      data: properties,
      count: properties.length,
    });
  } catch (error) {
    console.error("Get admin properties error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load properties",
    });
  }
}

/**
 * GET /api/admin/properties/:id
 *
 * Returns one property with full admin details.
 */
export async function getAdminProperty(
  req: Request,
  res: Response
) {
  try {
    const id = getPropertyId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    const property = await prisma.property.findUnique({
      where: {
        id,
      },
      include: {
        landlord: {
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
              },
            },
          },
        },
        marketer: {
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
              },
            },
          },
        },

        // Real Kenya geography relations.
        // Property location is determined by:
        // County -> Constituency -> Ward.
        countyRelation: true,
        constituency: true,
        ward: true,

        place: true,
        images: {
          orderBy: {
            sortOrder: "asc",
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
        viewingRequests: {
          include: {
            renter: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            assignedMarketer: {
              include: {
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
            },
            statusHistory: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        shortlists: {
          include: {
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
        message: "Property not found",
      });
    }

    return res.json({
      success: true,
      data: property,
    });
  } catch (error) {
    console.error("Get admin property error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load property",
    });
  }
}

/**
 * POST /api/admin/properties
 *
 * Creates a property directly from the admin panel.
 */
export async function createProperty(
  req: Request,
  res: Response
) {
  try {
    const {
      title,
      description,
      propertyType,
      rent,
      viewingFee,
      deposit,
      countyId,
      constituencyId,
      wardId,
      bedrooms,
      bathrooms,
      available,
      verified,
      images,
      amenityIds,
    } = req.body;

    const normalizedTitle = normalizeString(title);
    const normalizedDescription = normalizeString(description);

    const normalizedCountyId = normalizeString(countyId);
    const normalizedConstituencyId =
      normalizeString(constituencyId);
    const normalizedWardId = normalizeString(wardId);

    if (!normalizedTitle) {
      return res.status(400).json({
        success: false,
        message: "Property title is required",
      });
    }

    if (!isValidPropertyType(propertyType)) {
      return res.status(400).json({
        success: false,
        message: "Valid property type is required",
      });
    }

    if (!normalizedCountyId) {
      return res.status(400).json({
        success: false,
        message: "County selection is required",
      });
    }

    if (!normalizedConstituencyId) {
      return res.status(400).json({
        success: false,
        message: "Constituency selection is required",
      });
    }

    if (!normalizedWardId) {
      return res.status(400).json({
        success: false,
        message: "Ward selection is required",
      });
    }

    /*
     * Validate the Kenya geography hierarchy:
     *
     * County
     *   -> Constituency
     *      -> Ward
     *
     * We never trust IDs supplied by the frontend.
     */
    const selectedCounty = await prisma.county.findUnique({
      where: {
        id: normalizedCountyId,
      },
    });

    if (!selectedCounty) {
      return res.status(400).json({
        success: false,
        message: "Selected county does not exist",
      });
    }

    const selectedConstituency =
      await prisma.constituency.findFirst({
        where: {
          id: normalizedConstituencyId,
          countyId: normalizedCountyId,
        },
      });

    if (!selectedConstituency) {
      return res.status(400).json({
        success: false,
        message:
          "Selected constituency does not belong to the selected county",
      });
    }

    const selectedWard = await prisma.ward.findFirst({
      where: {
        id: normalizedWardId,
        constituencyId: normalizedConstituencyId,
      },
    });

    if (!selectedWard) {
      return res.status(400).json({
        success: false,
        message:
          "Selected ward does not belong to the selected constituency",
      });
    }

    const normalizedRent = normalizeOptionalInteger(
      rent,
      "rent"
    );

    if (normalizedRent === undefined || normalizedRent <= 0) {
      return res.status(400).json({
        success: false,
        message: "Rent must be greater than zero",
      });
    }

    const normalizedViewingFee = normalizeOptionalInteger(
      viewingFee,
      "viewingFee"
    );

    if (
      normalizedViewingFee !== undefined &&
      normalizedViewingFee < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Viewing fee cannot be negative",
      });
    }

    const normalizedDeposit = normalizeOptionalInteger(
      deposit,
      "deposit"
    );

    if (
      normalizedDeposit !== undefined &&
      normalizedDeposit < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Deposit cannot be negative",
      });
    }

    const normalizedBedrooms = normalizeOptionalInteger(
      bedrooms,
      "bedrooms"
    );

    const normalizedBathrooms = normalizeOptionalInteger(
      bathrooms,
      "bathrooms"
    );

    if (
      normalizedBedrooms !== undefined &&
      normalizedBedrooms < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Bedrooms cannot be negative",
      });
    }

    if (
      normalizedBathrooms !== undefined &&
      normalizedBathrooms < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Bathrooms cannot be negative",
      });
    }

    const normalizedImages = normalizeImages(images);
    const normalizedAmenityIds =
      normalizeAmenityIds(amenityIds);

    /*
     * Validate every selected amenity before creating the
     * property. The frontend only sends IDs; the database
     * remains the source of truth for the catalogue.
     */
    const missingAmenityIds =
      await findMissingAmenityIds(normalizedAmenityIds);

    if (missingAmenityIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: "One or more selected amenities do not exist",
        missingAmenityIds,
      });
    }

    const adminId = getUserId(req);

    const property = await prisma.$transaction(
      async (tx) => {
        const created = await tx.property.create({
          data: {
            title: normalizedTitle,
            description: normalizedDescription ?? null,
            propertyType,
            status: PropertyStatus.DRAFT,
            rent: normalizedRent,
            viewingFee: normalizedViewingFee ?? null,
            deposit: normalizedDeposit ?? null,
            countyId: normalizedCountyId,
            constituencyId: normalizedConstituencyId,
            wardId: normalizedWardId,

            // Legacy compatibility fields.
            // New property creation uses the normalized
            // Kenya geography IDs above and does not require
            // town, area, places, landlord, or marketer input.
            county: selectedCounty.name,
            town: "",
            area: "",

            bedrooms: normalizedBedrooms ?? undefined,
            bathrooms: normalizedBathrooms ?? undefined,
            available:
              typeof available === "boolean"
                ? available
                : true,
            verified:
              typeof verified === "boolean"
                ? verified
                : false,
          },
        });

        await tx.propertyStatusHistory.create({
          data: {
            propertyId: created.id,
            status: PropertyStatus.DRAFT,
            note: "Property created by admin",
            changedById: adminId,
          },
        });

        if (normalizedImages.length > 0) {
          await tx.propertyImage.createMany({
            data: normalizedImages.map((image) => ({
              propertyId: created.id,
              url: image.url,
              publicId: image.publicId,
              altText: image.altText,
              sortOrder: image.sortOrder,
              isPrimary: image.isPrimary,
            })),
          });
        }

        if (normalizedAmenityIds.length > 0) {
          await tx.propertyAmenity.createMany({
            data: normalizedAmenityIds.map((amenityId) => ({
              propertyId: created.id,
              amenityId,
            })),
            skipDuplicates: true,
          });
        }

        return created;
      }
    );

    const completeProperty =
      await prisma.property.findUnique({
        where: {
          id: property.id,
        },
        include: {
          landlord: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  role: true,
                },
              },
            },
          },
          marketer: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  role: true,
                },
              },
            },
          },
          images: {
            orderBy: {
              sortOrder: "asc",
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

    return res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: completeProperty,
    });
  } catch (error) {
    console.error("Create property error:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create property",
    });
  }
}

/**
 * PATCH /api/admin/properties/:id
 *
 * Updates property information.
 */
export async function updateProperty(
  req: Request,
  res: Response
) {
  try {
    const id = getPropertyId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    const existing = await prisma.property.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const body = req.body;
    const data: any = {};

    if (body.title !== undefined) {
      const title = normalizeString(body.title);

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Property title cannot be empty",
        });
      }

      data.title = title;
    }

    if (body.description !== undefined) {
      data.description =
        normalizeString(body.description) ?? null;
    }

    if (body.propertyType !== undefined) {
      if (!isValidPropertyType(body.propertyType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid property type",
        });
      }

      data.propertyType = body.propertyType;
    }

    /*
     * Geography can be updated individually, but whenever a
     * geography ID is supplied we validate the complete
     * hierarchy against the existing property values.
     */
    let nextCountyId = existing.countyId;
    let nextConstituencyId = existing.constituencyId;
    let nextWardId = existing.wardId;

    if (body.countyId !== undefined) {
      const value = normalizeString(body.countyId);

      if (!value) {
        return res.status(400).json({
          success: false,
          message: "County selection cannot be empty",
        });
      }

      nextCountyId = value;
    }

    if (body.constituencyId !== undefined) {
      const value =
        normalizeString(body.constituencyId);

      if (!value) {
        return res.status(400).json({
          success: false,
          message:
            "Constituency selection cannot be empty",
        });
      }

      nextConstituencyId = value;
    }

    if (body.wardId !== undefined) {
      const value = normalizeString(body.wardId);

      if (!value) {
        return res.status(400).json({
          success: false,
          message: "Ward selection cannot be empty",
        });
      }

      nextWardId = value;
    }

    if (
      body.countyId !== undefined ||
      body.constituencyId !== undefined ||
      body.wardId !== undefined
    ) {
      const selectedCounty =
        await prisma.county.findUnique({
          where: {
            id: nextCountyId,
          },
        });

      if (!selectedCounty) {
        return res.status(400).json({
          success: false,
          message: "Selected county does not exist",
        });
      }

      const selectedConstituency =
        await prisma.constituency.findFirst({
          where: {
            id: nextConstituencyId,
            countyId: nextCountyId,
          },
        });

      if (!selectedConstituency) {
        return res.status(400).json({
          success: false,
          message:
            "Selected constituency does not belong to the selected county",
        });
      }

      const selectedWard =
        await prisma.ward.findFirst({
          where: {
            id: nextWardId,
            constituencyId: nextConstituencyId,
          },
        });

      if (!selectedWard) {
        return res.status(400).json({
          success: false,
          message:
            "Selected ward does not belong to the selected constituency",
        });
      }

      data.countyId = nextCountyId;
      data.constituencyId = nextConstituencyId;
      data.wardId = nextWardId;
    }

    if (body.rent !== undefined) {
      const rent = normalizeOptionalInteger(
        body.rent,
        "rent"
      );

      if (rent === undefined || rent <= 0) {
        return res.status(400).json({
          success: false,
          message: "Rent must be greater than zero",
        });
      }

      data.rent = rent;
    }

    if (body.viewingFee !== undefined) {
      const viewingFee = normalizeOptionalInteger(
        body.viewingFee,
        "viewingFee"
      );

      if (viewingFee !== undefined && viewingFee < 0) {
        return res.status(400).json({
          success: false,
          message: "Viewing fee cannot be negative",
        });
      }

      data.viewingFee = viewingFee ?? null;
    }

    if (body.deposit !== undefined) {
      const deposit = normalizeOptionalInteger(
        body.deposit,
        "deposit"
      );

      if (deposit !== undefined && deposit < 0) {
        return res.status(400).json({
          success: false,
          message: "Deposit cannot be negative",
        });
      }

      data.deposit = deposit ?? null;
    }

    for (const field of ["county", "town", "area"]) {
      if (body[field] !== undefined) {
        const value = normalizeString(body[field]);

        if (!value) {
          return res.status(400).json({
            success: false,
            message: `${field} cannot be empty`,
          });
        }

        data[field] = value;
      }
    }

    if (body.placeId !== undefined) {
      const normalizedPlaceId =
        normalizeString(body.placeId);

      data.placeId = normalizedPlaceId ?? null;

      if (normalizedPlaceId) {
        const place = await prisma.place.findUnique({
          where: {
            id: normalizedPlaceId,
          },
        });

        if (!place) {
          return res.status(400).json({
            success: false,
            message: "Selected place does not exist",
          });
        }
      }
    }

    if (body.latitude !== undefined) {
      data.latitude =
        normalizeOptionalNumber(
          body.latitude,
          "latitude"
        ) ?? null;
    }

    if (body.longitude !== undefined) {
      data.longitude =
        normalizeOptionalNumber(
          body.longitude,
          "longitude"
        ) ?? null;
    }

    if (body.bedrooms !== undefined) {
      const bedrooms = normalizeOptionalInteger(
        body.bedrooms,
        "bedrooms"
      );

      if (bedrooms !== undefined && bedrooms < 0) {
        return res.status(400).json({
          success: false,
          message: "Bedrooms cannot be negative",
        });
      }

      data.bedrooms = bedrooms ?? null;
    }

    if (body.bathrooms !== undefined) {
      const bathrooms = normalizeOptionalInteger(
        body.bathrooms,
        "bathrooms"
      );

      if (bathrooms !== undefined && bathrooms < 0) {
        return res.status(400).json({
          success: false,
          message: "Bathrooms cannot be negative",
        });
      }

      data.bathrooms = bathrooms ?? null;
    }

    if (body.available !== undefined) {
      if (typeof body.available !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "available must be a boolean",
        });
      }

      if (
        existing.status === PropertyStatus.RENTED &&
        body.available === true
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A rented property cannot be marked available. Change its status first.",
        });
      }

      data.available = body.available;
    }

    if (body.verified !== undefined) {
      if (typeof body.verified !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "verified must be a boolean",
        });
      }

      data.verified = body.verified;
    }

    if (body.landlordId !== undefined) {
      const normalizedLandlordId =
        normalizeString(body.landlordId);

      if (!normalizedLandlordId) {
        data.landlordId = null;
      } else {
        const landlord =
          await prisma.landlord.findUnique({
            where: {
              id: normalizedLandlordId,
            },
            include: {
              user: {
                select: {
                  role: true,
                  accountStatus: true,
                  isActive: true,
                },
              },
            },
          });

        if (!landlord) {
          return res.status(400).json({
            success: false,
            message: "Selected landlord does not exist",
          });
        }

        if (
          landlord.user.role !== "LANDLORD" ||
          landlord.user.accountStatus !== "ACTIVE" ||
          !landlord.user.isActive
        ) {
          return res.status(400).json({
            success: false,
            message: "Selected landlord is not active",
          });
        }

        data.landlordId = normalizedLandlordId;
      }
    }

    if (body.marketerId !== undefined) {
      const normalizedMarketerId =
        normalizeString(body.marketerId);

      if (!normalizedMarketerId) {
        data.marketerId = null;
      } else {
        const marketer =
          await prisma.marketer.findUnique({
            where: {
              id: normalizedMarketerId,
            },
            include: {
              user: {
                select: {
                  role: true,
                  accountStatus: true,
                  isActive: true,
                },
              },
            },
          });

        if (!marketer) {
          return res.status(400).json({
            success: false,
            message: "Selected marketer does not exist",
          });
        }

        if (
          marketer.user.role !== "MARKETER" ||
          marketer.user.accountStatus !== "ACTIVE" ||
          !marketer.user.isActive
        ) {
          return res.status(400).json({
            success: false,
            message: "Selected marketer is not active",
          });
        }

        data.marketerId = normalizedMarketerId;
      }
    }

    /*
     * Validate amenities before starting the update transaction.
     *
     * This prevents an invalid amenity selection from deleting
     * the property's existing amenity relationships.
     */
    let normalizedUpdateAmenityIds: string[] | null = null;

    if (Array.isArray(body.amenityIds)) {
      normalizedUpdateAmenityIds =
        normalizeAmenityIds(body.amenityIds);

      const missingAmenityIds =
        await findMissingAmenityIds(
          normalizedUpdateAmenityIds
        );

      if (missingAmenityIds.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "One or more selected amenities do not exist",
          missingAmenityIds,
        });
      }
    }

    const adminId = getUserId(req);

    const property = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.property.update({
          where: {
            id,
          },
          data,
        });

        if (Array.isArray(body.images)) {
          await tx.propertyImage.deleteMany({
            where: {
              propertyId: id,
            },
          });

          const images = normalizeImages(body.images);

          if (images.length > 0) {
            await tx.propertyImage.createMany({
              data: images.map((image) => ({
                propertyId: id,
                url: image.url,
                publicId: image.publicId,
                altText: image.altText,
                sortOrder: image.sortOrder,
                isPrimary: image.isPrimary,
              })),
            });
          }
        }

        if (normalizedUpdateAmenityIds !== null) {
          await tx.propertyAmenity.deleteMany({
            where: {
              propertyId: id,
            },
          });

          if (normalizedUpdateAmenityIds.length > 0) {
            await tx.propertyAmenity.createMany({
              data: normalizedUpdateAmenityIds.map(
                (amenityId) => ({
                  propertyId: id,
                  amenityId,
                })
              ),
              skipDuplicates: true,
            });
          }
        }

        /**
         * Record an audit entry when a status is explicitly
         * supplied through the update endpoint.
         *
         * Dedicated status endpoint remains preferred for
         * workflow changes.
         */
        if (
          body.status !== undefined &&
          isValidPropertyStatus(body.status) &&
          body.status !== existing.status
        ) {
          await tx.propertyStatusHistory.create({
            data: {
              propertyId: id,
              status: body.status,
              note:
                normalizeString(body.statusNote) ??
                "Property status changed during update",
              changedById: adminId,
            },
          });
        }

        return updated;
      }
    );

    const completeProperty =
      await prisma.property.findUnique({
        where: {
          id: property.id,
        },
        include: {
          landlord: {
            include: {
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
          },
          marketer: {
            include: {
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
          },
          images: {
            orderBy: {
              sortOrder: "asc",
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

    return res.json({
      success: true,
      message: "Property updated successfully",
      data: completeProperty,
    });
  } catch (error) {
    console.error("Update property error:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update property",
    });
  }
}

/**
 * PATCH /api/admin/properties/:id/status
 *
 * Changes the property workflow status.
 *
 * Supported:
 * DRAFT
 * PENDING_VERIFICATION
 * CHANGES_REQUIRED
 * ACTIVE
 * RENTED
 * INACTIVE
 * REJECTED
 */
export async function updatePropertyStatus(
  req: Request,
  res: Response
) {
  try {
    const id = getPropertyId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    const { status, note } = req.body;

    if (!isValidPropertyStatus(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property status",
      });
    }

    const existing = await prisma.property.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (
      existing.status === PropertyStatus.RENTED &&
      status !== PropertyStatus.RENTED
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A rented property cannot be moved to another status through this endpoint.",
      });
    }

    const adminId = getUserId(req);

    const result = await prisma.$transaction(
      async (tx) => {
        const updateData: any = {
          status,
        };

        if (status === PropertyStatus.RENTED) {
          updateData.available = false;
        }

        if (status === PropertyStatus.ACTIVE) {
          updateData.available = true;
        }

        const property = await tx.property.update({
          where: {
            id,
          },
          data: updateData,
        });

        await tx.propertyStatusHistory.create({
          data: {
            propertyId: id,
            status,
            note: normalizeString(note) ?? null,
            changedById: adminId,
          },
        });

        /**
         * When a property is explicitly marked RENTED,
         * close active viewing requests.
         *
         * The viewing records remain in the database so
         * history is preserved.
         */
        if (status === PropertyStatus.RENTED) {
          const activeViewingStatuses: ViewingStatus[] = [
            ViewingStatus.REQUESTED,
            ViewingStatus.CONFIRMED,
            ViewingStatus.ASSIGNED,
          ];

          const activeViewings =
            await tx.viewingRequest.findMany({
              where: {
                propertyId: id,
                status: {
                  in: activeViewingStatuses,
                },
              },
              select: {
                id: true,
              },
            });

          if (activeViewings.length > 0) {
            const viewingIds =
              activeViewings.map(
                (viewing) => viewing.id
              );

            await tx.viewingRequest.updateMany({
              where: {
                id: {
                  in: viewingIds,
                },
              },
              data: {
                status: ViewingStatus.CANCELLED,
              },
            });

            await tx.viewingStatusHistory.createMany({
              data: viewingIds.map((viewingId) => ({
                viewingId,
                status: ViewingStatus.CANCELLED,
                note:
                  "Property marked as taken by admin",
              })),
            });
          }
        }

        return property;
      }
    );

    return res.json({
      success: true,
      message:
        status === PropertyStatus.RENTED
          ? "Property marked as taken and active viewing requests were closed"
          : "Property status updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Update property status error:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update property status",
    });
  }
}

/**
 * PATCH /api/admin/properties/:id/availability
 *
 * Controls whether the property is currently available.
 *
 * Marking unavailable does NOT automatically mean rented.
 * The explicit "taken" action uses status=RENTED.
 */
export async function updatePropertyAvailability(
  req: Request,
  res: Response
) {
  try {
    const id = getPropertyId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Property ID is required",
      });
    }

    const { available } = req.body;

    if (typeof available !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "available must be a boolean",
      });
    }

    const existing = await prisma.property.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (
      existing.status === PropertyStatus.RENTED &&
      available
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A rented property cannot be marked available. Change its status first.",
      });
    }

    const property =
      await prisma.property.update({
        where: {
          id,
        },
        data: {
          available,
        },
      });

    return res.json({
      success: true,
      message: available
        ? "Property marked available"
        : "Property marked unavailable",
      data: property,
    });
  } catch (error) {
    console.error(
      "Update property availability error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update property availability",
    });
  }
}
