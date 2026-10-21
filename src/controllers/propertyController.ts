import type { Request, Response } from "express";
import {
  PropertyPurpose,
  PropertyStatus,
  LongStayType,
  ShortStayType,
  StayMode,
  FurnishingType,
  ViewingStatus,
} from "@prisma/client";

import prisma from "../config/prisma";
import { requireUploadedPropertyVideo } from "../services/propertyVideoUploadService";
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
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
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
        createdBy: {
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

        verifiedBy: {
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

        marketerCoverage: true,

        // Real Kenya geography relations.
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
      purpose,
      longStayType,
      shortStayType,
      stayMode,
      furnishing,

      monthlyRent,
      deposit,
      viewingFee,
      serviceCharge,

      dayRate,
      nightRate,
      dayNightRate,

      bedrooms,
      bathrooms,
      beds,
      maxGuests,
      rooms,

      countyId,
      constituencyId,
      wardId,
      placeId,

      available,
      verified,

      marketerId,
      images,
      amenityIds,
      videoUrl,
      videoPublicId,
      videoMimeType,
    } = req.body;

    const adminId = getUserId(req);

    const normalizedTitle = normalizeString(title);
    const normalizedDescription = normalizeString(description);
    const normalizedPurpose =
      normalizeString(purpose)?.toUpperCase();

    const normalizedLongStayType =
      normalizeString(longStayType)?.toUpperCase();

    const normalizedShortStayType =
      normalizeString(shortStayType)?.toUpperCase();

    const normalizedStayMode =
      normalizeString(stayMode)?.toUpperCase();

    const normalizedFurnishing =
      normalizeString(furnishing)?.toUpperCase();

    const normalizedCountyId = normalizeString(countyId);
    const normalizedConstituencyId =
      normalizeString(constituencyId);
    const normalizedWardId = normalizeString(wardId);
    const normalizedPlaceId = normalizeString(placeId);
    const normalizedMarketerId = normalizeString(marketerId);

    if (!normalizedTitle) {
      return res.status(400).json({
        success: false,
        message: "Property title is required",
      });
    }

    if (
      !normalizedPurpose ||
      !Object.values(PropertyPurpose).includes(
        normalizedPurpose as PropertyPurpose
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid property purpose is required",
      });
    }

    const propertyPurpose =
      normalizedPurpose as PropertyPurpose;

    if (
      propertyPurpose === PropertyPurpose.LONG_STAY &&
      (
        !normalizedLongStayType ||
        !Object.values(LongStayType).includes(
          normalizedLongStayType as LongStayType
        )
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid long-stay accommodation type is required",
      });
    }

    if (
      propertyPurpose === PropertyPurpose.SHORT_STAY &&
      (
        !normalizedShortStayType ||
        !Object.values(ShortStayType).includes(
          normalizedShortStayType as ShortStayType
        )
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid short-stay accommodation type is required",
      });
    }

    if (
      propertyPurpose === PropertyPurpose.SHORT_STAY &&
      (
        !normalizedStayMode ||
        !Object.values(StayMode).includes(
          normalizedStayMode as StayMode
        )
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid short-stay mode is required",
      });
    }

    if (
      normalizedFurnishing &&
      !Object.values(FurnishingType).includes(
        normalizedFurnishing as FurnishingType
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid furnishing type",
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

    if (!normalizedMarketerId) {
      return res.status(400).json({
        success: false,
        message:
          "Source marketer selection is required",
      });
    }

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

    const selectedMarketer =
      await prisma.marketer.findUnique({
        where: {
          id: normalizedMarketerId,
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
              isActive: true,
            },
          },
        },
      });

    if (!selectedMarketer) {
      return res.status(400).json({
        success: false,
        message: "Selected source marketer does not exist",
      });
    }

    if (!selectedMarketer.user.isActive) {
      return res.status(400).json({
        success: false,
        message:
          "Selected source marketer is inactive",
      });
    }

    if (normalizedPlaceId) {
      const selectedPlace = await prisma.place.findFirst({
        where: {
          id: normalizedPlaceId,
          countyId: normalizedCountyId,
        },
      });

      if (!selectedPlace) {
        return res.status(400).json({
          success: false,
          message:
            "Selected place does not belong to the selected county",
        });
      }
    }

    const normalizedMonthlyRent =
      normalizeOptionalInteger(
        monthlyRent,
        "monthlyRent"
      );

    const normalizedDeposit =
      normalizeOptionalInteger(
        deposit,
        "deposit"
      );

    const normalizedViewingFee =
      normalizeOptionalInteger(
        viewingFee,
        "viewingFee"
      );

    const normalizedServiceCharge =
      normalizeOptionalInteger(
        serviceCharge,
        "serviceCharge"
      );

    const normalizedDayRate =
      normalizeOptionalInteger(
        dayRate,
        "dayRate"
      );

    const normalizedNightRate =
      normalizeOptionalInteger(
        nightRate,
        "nightRate"
      );

    const normalizedDayNightRate =
      normalizeOptionalInteger(
        dayNightRate,
        "dayNightRate"
      );

    const normalizedBedrooms =
      normalizeOptionalInteger(
        bedrooms,
        "bedrooms"
      );

    const normalizedBathrooms =
      normalizeOptionalInteger(
        bathrooms,
        "bathrooms"
      );

    const normalizedBeds =
      normalizeOptionalInteger(
        beds,
        "beds"
      );

    const normalizedMaxGuests =
      normalizeOptionalInteger(
        maxGuests,
        "maxGuests"
      );

    const normalizedRooms =
      normalizeOptionalInteger(
        rooms,
        "rooms"
      );

    if (
      propertyPurpose === PropertyPurpose.LONG_STAY &&
      (
        normalizedMonthlyRent === undefined ||
        normalizedMonthlyRent <= 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Monthly rent must be greater than zero",
      });
    }

    if (propertyPurpose === PropertyPurpose.SHORT_STAY) {
      const mode = normalizedStayMode as StayMode;

      if (
        mode === StayMode.DAY &&
        (!normalizedDayRate ||
          normalizedDayRate <= 0)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Day rate must be greater than zero",
        });
      }

      if (
        mode === StayMode.OVERNIGHT &&
        (!normalizedNightRate ||
          normalizedNightRate <= 0)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Night rate must be greater than zero",
        });
      }

      if (
        mode === StayMode.DAY_AND_NIGHT &&
        (!normalizedDayNightRate ||
          normalizedDayNightRate <= 0)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Day-and-night rate must be greater than zero",
        });
      }

      if (
        mode === StayMode.FLEXIBLE &&
        !normalizedDayRate &&
        !normalizedNightRate &&
        !normalizedDayNightRate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "At least one short-stay rate is required",
        });
      }

      if (
        normalizedMaxGuests === undefined ||
        normalizedMaxGuests <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Maximum guests must be greater than zero",
        });
      }

      if (
        normalizedRooms === undefined ||
        normalizedRooms <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Number of rooms must be greater than zero",
        });
      }
    }

    for (const [value, fieldName] of [
      [normalizedDeposit, "deposit"],
      [normalizedViewingFee, "viewingFee"],
      [normalizedServiceCharge, "serviceCharge"],
      [normalizedDayRate, "dayRate"],
      [normalizedNightRate, "nightRate"],
      [normalizedDayNightRate, "dayNightRate"],
      [normalizedBedrooms, "bedrooms"],
      [normalizedBathrooms, "bathrooms"],
      [normalizedBeds, "beds"],
      [normalizedMaxGuests, "maxGuests"],
      [normalizedRooms, "rooms"],
    ] as Array<[number | undefined, string]>) {
      if (value !== undefined && value < 0) {
        return res.status(400).json({
          success: false,
          message: `${fieldName} cannot be negative`,
        });
      }
    }

    const normalizedImages = normalizeImages(images);
    const uploadedVideo = await requireUploadedPropertyVideo(
      videoUrl,
      videoPublicId,
      videoMimeType,
    );
    const normalizedAmenityIds =
      normalizeAmenityIds(amenityIds);

    const missingAmenityIds =
      await findMissingAmenityIds(
        normalizedAmenityIds
      );

    if (missingAmenityIds.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected amenities do not exist",
        missingAmenityIds,
      });
    }

    const isVerified =
      typeof verified === "boolean"
        ? verified
        : false;

    const property =
      await prisma.$transaction(async (tx) => {
        const created =
          await tx.property.create({
            data: {
              title: normalizedTitle,
              description:
                normalizedDescription ?? null,

              purpose: propertyPurpose,

              longStayType:
                propertyPurpose ===
                PropertyPurpose.LONG_STAY
                  ? (normalizedLongStayType as LongStayType)
                  : null,

              shortStayType:
                propertyPurpose ===
                PropertyPurpose.SHORT_STAY
                  ? (normalizedShortStayType as ShortStayType)
                  : null,

              stayMode:
                propertyPurpose ===
                PropertyPurpose.SHORT_STAY
                  ? (normalizedStayMode as StayMode)
                  : null,

              furnishing:
                normalizedFurnishing
                  ? (normalizedFurnishing as FurnishingType)
                  : null,

              status: PropertyStatus.DRAFT,
              videoUrl: uploadedVideo.videoUrl,
              videoPublicId: uploadedVideo.videoPublicId,
              videoMimeType: uploadedVideo.videoMimeType,

              monthlyRent:
                propertyPurpose ===
                PropertyPurpose.LONG_STAY
                  ? normalizedMonthlyRent
                  : null,

              deposit:
                propertyPurpose ===
                PropertyPurpose.LONG_STAY
                  ? normalizedDeposit
                  : null,

              viewingFee:
                propertyPurpose ===
                PropertyPurpose.LONG_STAY
                  ? normalizedViewingFee
                  : null,

              serviceCharge:
                propertyPurpose ===
                PropertyPurpose.LONG_STAY
                  ? normalizedServiceCharge
                  : null,

              dayRate:
                propertyPurpose ===
                PropertyPurpose.SHORT_STAY
                  ? normalizedDayRate
                  : null,

              nightRate:
                propertyPurpose ===
                PropertyPurpose.SHORT_STAY
                  ? normalizedNightRate
                  : null,

              dayNightRate:
                propertyPurpose ===
                PropertyPurpose.SHORT_STAY
                  ? normalizedDayNightRate
                  : null,

              bedrooms:
                normalizedBedrooms,

              bathrooms:
                normalizedBathrooms,

              beds:
                propertyPurpose ===
                PropertyPurpose.SHORT_STAY
                  ? normalizedBeds
                  : null,

              maxGuests:
                propertyPurpose ===
                PropertyPurpose.SHORT_STAY
                  ? normalizedMaxGuests
                  : null,

              rooms:
                propertyPurpose ===
                PropertyPurpose.SHORT_STAY
                  ? normalizedRooms
                  : null,

              countyId:
                normalizedCountyId,

              constituencyId:
                normalizedConstituencyId,

              wardId:
                normalizedWardId,

              county:
                selectedCounty.name,

              town: "",
              area: "",

              placeId:
                normalizedPlaceId ?? null,

              latitude: null,
              longitude: null,

              available:
                typeof available === "boolean"
                  ? available
                  : true,

              verified: isVerified,

              verifiedAt:
                isVerified ? new Date() : null,

              verifiedById:
                isVerified ? adminId : null,

              createdById: adminId,

              marketerId:
                normalizedMarketerId,

              amenities:
                normalizedAmenityIds.length > 0
                  ? {
                      create:
                        normalizedAmenityIds.map(
                          (amenityId) => ({
                            amenityId,
                          })
                        ),
                    }
                  : undefined,

              statusHistory: {
                create: {
                  toStatus:
                    PropertyStatus.DRAFT,
                  note:
                    "Property created by admin",
                  changedById: adminId,
                },
              },
            },
          });

        if (normalizedImages.length > 0) {
          await tx.propertyImage.createMany({
            data: normalizedImages.map(
              (image) => ({
                propertyId: created.id,
                uploadedById: adminId,
                url: image.url,
                publicId: image.publicId,
                altText: image.altText,
                sortOrder: image.sortOrder,
                isPrimary: image.isPrimary,
              })
            ),
          });
        }

        return created;
      });

    const completeProperty =
      await prisma.property.findUnique({
        where: {
          id: property.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
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

    if (existing.status === PropertyStatus.RENTED) {
      return res.status(400).json({
        success: false,
        message: "A rented property is locked and cannot be edited.",
      });
    }

    const body = req.body;
    const data: any = {};

    /*
     * ---------------------------------------------------------
     * BASIC INFORMATION
     * ---------------------------------------------------------
     */

    if (body.title !== undefined) {
      const title = normalizeString(body.title);

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Property title cannot be empty",
        });
      }

      if (title.length < 3) {
        return res.status(400).json({
          success: false,
          message: "Property title must be at least 3 characters",
        });
      }

      data.title = title;
    }

    if (body.description !== undefined) {
      data.description =
        normalizeString(body.description) ?? null;
    }

    /*
     * ---------------------------------------------------------
     * PURPOSE
     * ---------------------------------------------------------
     */

    let nextPurpose: PropertyPurpose = existing.purpose;

    if (body.purpose !== undefined) {
      const normalizedPurpose =
        normalizeString(body.purpose)?.toUpperCase();

      if (
        !normalizedPurpose ||
        !Object.values(PropertyPurpose).includes(
          normalizedPurpose as PropertyPurpose
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid property purpose",
        });
      }

      nextPurpose = normalizedPurpose as PropertyPurpose;
      data.purpose = nextPurpose;
    }

    /*
     * ---------------------------------------------------------
     * PROPERTY TYPE
     * ---------------------------------------------------------
     */

    let nextLongStayType = existing.longStayType;
    let nextShortStayType = existing.shortStayType;

    if (body.longStayType !== undefined) {
      const value =
        normalizeString(body.longStayType)?.toUpperCase();

      if (
        value &&
        !Object.values(LongStayType).includes(
          value as LongStayType
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid long-stay property type",
        });
      }

      nextLongStayType =
        (value as LongStayType | undefined) ?? null;
    }

    if (body.shortStayType !== undefined) {
      const value =
        normalizeString(body.shortStayType)?.toUpperCase();

      if (
        value &&
        !Object.values(ShortStayType).includes(
          value as ShortStayType
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid short-stay property type",
        });
      }

      nextShortStayType =
        (value as ShortStayType | undefined) ?? null;
    }

    if (nextPurpose === PropertyPurpose.LONG_STAY) {
      if (!nextLongStayType) {
        return res.status(400).json({
          success: false,
          message: "A long-stay property type is required",
        });
      }

      data.longStayType = nextLongStayType;
      data.shortStayType = null;
    }

    if (nextPurpose === PropertyPurpose.SHORT_STAY) {
      if (!nextShortStayType) {
        return res.status(400).json({
          success: false,
          message: "A short-stay property type is required",
        });
      }

      data.shortStayType = nextShortStayType;
      data.longStayType = null;
    }

    /*
     * ---------------------------------------------------------
     * STAY MODE
     * ---------------------------------------------------------
     */

    let nextStayMode = existing.stayMode;

    if (body.stayMode !== undefined) {
      const value =
        normalizeString(body.stayMode)?.toUpperCase();

      if (
        value &&
        !Object.values(StayMode).includes(
          value as StayMode
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid stay mode",
        });
      }

      nextStayMode =
        (value as StayMode | undefined) ?? null;
    }

    if (nextPurpose === PropertyPurpose.SHORT_STAY) {
      if (!nextStayMode) {
        return res.status(400).json({
          success: false,
          message: "Stay mode is required for short-stay properties",
        });
      }

      data.stayMode = nextStayMode;
    } else {
      data.stayMode = null;
    }

    /*
     * ---------------------------------------------------------
     * FURNISHING
     * ---------------------------------------------------------
     */

    if (body.furnishing !== undefined) {
      const value =
        normalizeString(body.furnishing)?.toUpperCase();

      if (
        value &&
        !Object.values(FurnishingType).includes(
          value as FurnishingType
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid furnishing type",
        });
      }

      data.furnishing =
        (value as FurnishingType | undefined) ?? null;
    }

    /*
     * ---------------------------------------------------------
     * LONG-STAY PRICING
     * ---------------------------------------------------------
     */

    let monthlyRent = existing.monthlyRent;
    let deposit = existing.deposit;
    let viewingFee = existing.viewingFee;
    let serviceCharge = existing.serviceCharge;

    if (body.monthlyRent !== undefined) {
      monthlyRent = normalizeOptionalInteger(
        body.monthlyRent,
        "monthlyRent"
      ) ?? null;

      if (monthlyRent === null || monthlyRent <= 0) {
        return res.status(400).json({
          success: false,
          message: "Monthly rent must be greater than zero",
        });
      }
    }

    if (body.deposit !== undefined) {
      deposit =
        normalizeOptionalInteger(
          body.deposit,
          "deposit"
        ) ?? null;

      if (deposit !== null && deposit < 0) {
        return res.status(400).json({
          success: false,
          message: "Deposit cannot be negative",
        });
      }
    }

    if (body.viewingFee !== undefined) {
      viewingFee =
        normalizeOptionalInteger(
          body.viewingFee,
          "viewingFee"
        ) ?? null;

      if (viewingFee !== null && viewingFee < 0) {
        return res.status(400).json({
          success: false,
          message: "Viewing fee cannot be negative",
        });
      }
    }

    if (body.serviceCharge !== undefined) {
      serviceCharge =
        normalizeOptionalInteger(
          body.serviceCharge,
          "serviceCharge"
        ) ?? null;

      if (serviceCharge !== null && serviceCharge < 0) {
        return res.status(400).json({
          success: false,
          message: "Service charge cannot be negative",
        });
      }
    }

    if (nextPurpose === PropertyPurpose.LONG_STAY) {
      if (!monthlyRent || monthlyRent <= 0) {
        return res.status(400).json({
          success: false,
          message: "Monthly rent must be greater than zero",
        });
      }

      data.monthlyRent = monthlyRent;
      data.deposit = deposit;
      data.viewingFee = viewingFee;
      data.serviceCharge = serviceCharge;

      data.dayRate = null;
      data.nightRate = null;
      data.dayNightRate = null;
    }

    /*
     * ---------------------------------------------------------
     * SHORT-STAY PRICING
     * ---------------------------------------------------------
     */

    let dayRate = existing.dayRate;
    let nightRate = existing.nightRate;
    let dayNightRate = existing.dayNightRate;

    if (body.dayRate !== undefined) {
      dayRate =
        normalizeOptionalInteger(
          body.dayRate,
          "dayRate"
        ) ?? null;

      if (dayRate !== null && dayRate <= 0) {
        return res.status(400).json({
          success: false,
          message: "Day rate must be greater than zero",
        });
      }
    }

    if (body.nightRate !== undefined) {
      nightRate =
        normalizeOptionalInteger(
          body.nightRate,
          "nightRate"
        ) ?? null;

      if (nightRate !== null && nightRate <= 0) {
        return res.status(400).json({
          success: false,
          message: "Night rate must be greater than zero",
        });
      }
    }

    if (body.dayNightRate !== undefined) {
      dayNightRate =
        normalizeOptionalInteger(
          body.dayNightRate,
          "dayNightRate"
        ) ?? null;

      if (dayNightRate !== null && dayNightRate <= 0) {
        return res.status(400).json({
          success: false,
          message: "Day-and-night rate must be greater than zero",
        });
      }
    }

    if (nextPurpose === PropertyPurpose.SHORT_STAY) {
      if (nextStayMode === StayMode.DAY && (!dayRate || dayRate <= 0)) {
        return res.status(400).json({
          success: false,
          message: "Day rate must be greater than zero",
        });
      }

      if (
        nextStayMode === StayMode.OVERNIGHT &&
        (!nightRate || nightRate <= 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "Night rate must be greater than zero",
        });
      }

      if (
        nextStayMode === StayMode.DAY_AND_NIGHT &&
        (!dayNightRate || dayNightRate <= 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "Day-and-night rate must be greater than zero",
        });
      }

      if (
        nextStayMode === StayMode.FLEXIBLE &&
        !dayRate &&
        !nightRate &&
        !dayNightRate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "At least one short-stay rate is required for flexible stays",
        });
      }

      data.dayRate = dayRate;
      data.nightRate = nightRate;
      data.dayNightRate = dayNightRate;

      data.monthlyRent = null;
      data.deposit = null;
      data.viewingFee = null;
      data.serviceCharge = null;
    }

    /*
     * ---------------------------------------------------------
     * BEDROOMS / BATHROOMS / BEDS / GUESTS
     * ---------------------------------------------------------
     */

    for (const field of [
      "bedrooms",
      "bathrooms",
      "beds",
      "maxGuests",
      "rooms",
    ]) {
      if (body[field] !== undefined) {
        const value = normalizeOptionalInteger(
          body[field],
          field
        );

        if (value !== undefined && value < 0) {
          return res.status(400).json({
            success: false,
            message: `${field} cannot be negative`,
          });
        }

        data[field] = value ?? null;
      }
    }

    if (nextPurpose === PropertyPurpose.SHORT_STAY) {
      const nextRooms =
        body.rooms !== undefined
          ? data.rooms
          : existing.rooms;

      if (
        nextRooms === undefined ||
        nextRooms === null ||
        nextRooms <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Number of rooms must be greater than zero",
        });
      }

      data.rooms = nextRooms;
    } else {
      data.rooms = null;
    }

    /*
     * ---------------------------------------------------------
     * GEOGRAPHY
     * ---------------------------------------------------------
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
      const value = normalizeString(body.constituencyId);

      if (!value) {
        return res.status(400).json({
          success: false,
          message: "Constituency selection cannot be empty",
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

    const geographyChanged =
      nextCountyId !== existing.countyId ||
      nextConstituencyId !== existing.constituencyId ||
      nextWardId !== existing.wardId;

    let geography = null;

    if (geographyChanged) {
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

      geography = {
        county: selectedCounty,
        constituency: selectedConstituency,
        ward: selectedWard,
      };

      data.countyId = nextCountyId;
      data.constituencyId = nextConstituencyId;
      data.wardId = nextWardId;
      data.county = selectedCounty.name;
    }

    /*
     * ---------------------------------------------------------
     * LOCATION DETAILS
     * ---------------------------------------------------------
     */

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

        if (place.countyId !== nextCountyId) {
          return res.status(400).json({
            success: false,
            message:
              "Selected place does not belong to the selected county",
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

    /*
     * ---------------------------------------------------------
     * AVAILABILITY
     * ---------------------------------------------------------
     */

    if (body.available !== undefined) {
      if (typeof body.available !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "available must be a boolean",
        });
      }

      data.available = body.available;
    }

    /*
     * ---------------------------------------------------------
     * VERIFICATION
     * ---------------------------------------------------------
     */

    const adminId = getUserId(req);

    if (body.verified !== undefined) {
      if (typeof body.verified !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "verified must be a boolean",
        });
      }

      data.verified = body.verified;

      if (body.verified === true) {
        data.verifiedAt = new Date();
        data.verifiedById = adminId;
      } else {
        data.verifiedAt = null;
        data.verifiedById = null;
      }
    }

    /*
     * ---------------------------------------------------------
     * SOURCE MARKETER
     *
     * Every MAKAZII property must have a marketer/source.
     * Admin-created properties can still be sourced from a
     * specific marketer.
     * ---------------------------------------------------------
     */

    if (body.marketerId !== undefined) {
      const normalizedMarketerId =
        normalizeString(body.marketerId);

      if (!normalizedMarketerId) {
        return res.status(400).json({
          success: false,
          message: "A source marketer is required",
        });
      }

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

    /*
     * ---------------------------------------------------------
     * AMENITIES
     * ---------------------------------------------------------
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

    /*
     * ---------------------------------------------------------
     * UPDATE TRANSACTION
     * ---------------------------------------------------------
     */

    const property = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.property.update({
          where: {
            id,
          },
          data,
        });

        /*
         * Replace images only when images were explicitly
         * supplied in the request.
         */
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
                uploadedById: adminId,
                url: image.url,
                publicId: image.publicId,
                altText: image.altText,
                sortOrder: image.sortOrder,
                isPrimary: image.isPrimary,
              })),
            });
          }
        }

        /*
         * Replace amenities only when explicitly supplied.
         */
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

        /*
         * Record an audit entry when status is explicitly
         * changed through this endpoint.
         */
        if (
          body.status !== undefined &&
          isValidPropertyStatus(body.status) &&
          body.status !== existing.status
        ) {
          await tx.propertyStatusHistory.create({
            data: {
              propertyId: id,
              fromStatus: existing.status,
              toStatus: body.status,
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
 * PATCH /api/admin/properties/:id/video
 *
 * Attaches a previously uploaded and verified S3 video
 * to an existing property without modifying other fields.
 */
export async function updatePropertyVideo(
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
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (existing.status === PropertyStatus.RENTED) {
      return res.status(400).json({
        success: false,
        message: "A rented property is locked and cannot be edited.",
      });
    }

    const uploadedVideo = await requireUploadedPropertyVideo(
      req.body?.videoUrl,
      req.body?.videoPublicId,
      req.body?.videoMimeType
    );

    const property = await prisma.property.update({
      where: { id },
      data: uploadedVideo,
      select: {
        id: true,
        title: true,
        status: true,
        videoUrl: true,
        videoPublicId: true,
        videoMimeType: true,
      },
    });

    return res.json({
      success: true,
      message: "Property video attached successfully.",
      data: property,
    });
  } catch (error) {
    console.error("Attach property video error:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to attach the property video.",
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

    if (
      status === PropertyStatus.ACTIVE &&
      (!existing.videoUrl || !existing.videoPublicId || !existing.videoMimeType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Upload a property video before publishing this listing.",
      });
    }

    const adminId = getUserId(req);

    const result = await prisma.$transaction(
      async (tx) => {
        const updateData: any = {
          status,
        };

        /*
         * ACTIVE means the administrator has approved the property.
         * Record the verification details at the same time.
         */
        if (status === PropertyStatus.ACTIVE) {
          updateData.available = true;
          updateData.verified = true;
          updateData.verifiedAt = new Date();
          updateData.verifiedById = adminId;
          updateData.publishedAt = existing.publishedAt ?? new Date();
        }

        /*
         * RENTED means the property is no longer available.
         * Verification can remain historically recorded, but the
         * property is no longer a live available listing.
         */
        if (status === PropertyStatus.RENTED) {
          updateData.available = false;
        }

        /*
         * Any status that is not ACTIVE is no longer an approved
         * live listing. Clear the current verification state so
         * the property must be reviewed again before becoming ACTIVE.
         */
        if (
          status !== PropertyStatus.ACTIVE &&
          status !== PropertyStatus.RENTED
        ) {
          updateData.verified = false;
          updateData.verifiedAt = null;
          updateData.verifiedById = null;
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
            fromStatus: existing.status,
            toStatus: status,
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
            ViewingStatus.PENDING_PAYMENT,
            ViewingStatus.PAID,
            ViewingStatus.AWAITING_ASSIGNMENT,
            ViewingStatus.ASSIGNED,
            ViewingStatus.CONFIRMED,
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
          : status === PropertyStatus.ACTIVE
            ? "Property approved and activated successfully"
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
