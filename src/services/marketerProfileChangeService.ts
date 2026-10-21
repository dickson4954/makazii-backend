import prisma from "../config/prisma";
import type { MarketerProfileChangeStatus } from "@prisma/client";

interface CreateProfileChangeRequestInput {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  reason?: unknown;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeEmail(value: unknown): string | undefined {
  const email = normalizeString(value);

  if (!email) {
    return undefined;
  }

  return email.toLowerCase();
}

function normalizePhone(value: unknown): string | null | undefined {
  if (value === null || value === "") {
    return null;
  }

  const phone = normalizeString(value);

  if (!phone) {
    return null;
  }

  return phone;
}

function validateEmail(email: string): void {
  if (
    !email ||
    !email.includes("@") ||
    email.startsWith("@") ||
    email.endsWith("@")
  ) {
    throw new Error("Please provide a valid email address");
  }
}

function validatePhone(phone: string | null): void {
  if (phone && phone.length < 9) {
    throw new Error("Please provide a valid phone number");
  }
}

function validateName(
  name: string | undefined,
  field: string
): void {
  if (name !== undefined && name.length < 2) {
    throw new Error(
      `${field} must be at least 2 characters long`
    );
  }
}

/**
 * Create a marketer profile change request.
 *
 * Marketer changes are NOT applied immediately.
 * The current User values are stored so the admin
 * can see exactly what is changing.
 */
export async function createMarketerProfileChangeRequest(
  userId: string,
  input: CreateProfileChangeRequestInput
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      marketer: true,
    },
  });

  if (!user) {
    throw new Error("User account not found");
  }

  if (user.role !== "MARKETER") {
    throw new Error(
      "Only marketer accounts can submit marketer profile change requests"
    );
  }

  if (!user.marketer) {
    throw new Error(
      "Marketer profile was not found"
    );
  }

  if (!user.isActive) {
    throw new Error(
      "Your account is inactive"
    );
  }

  const requestedFirstName =
    normalizeString(input.firstName);

  const requestedLastName =
    normalizeString(input.lastName);

  const requestedEmail =
    normalizeEmail(input.email);

  const requestedPhone =
    normalizePhone(input.phone);

  const reason =
    normalizeString(input.reason);

  validateName(
    requestedFirstName,
    "First name"
  );

  validateName(
    requestedLastName,
    "Last name"
  );

  if (requestedEmail !== undefined) {
    validateEmail(requestedEmail);
  }

  if (requestedPhone !== undefined) {
    validatePhone(requestedPhone);
  }

  const changes = {
    firstName:
      requestedFirstName !== undefined &&
      requestedFirstName !== user.firstName,

    lastName:
      requestedLastName !== undefined &&
      requestedLastName !== user.lastName,

    email:
      requestedEmail !== undefined &&
      requestedEmail !== user.email,

    phone:
      requestedPhone !== undefined &&
      requestedPhone !== user.phone,
  };

  if (
    !changes.firstName &&
    !changes.lastName &&
    !changes.email &&
    !changes.phone
  ) {
    throw new Error(
      "No profile changes were requested"
    );
  }

  /**
   * Check for an existing pending request.
   *
   * A marketer must not have multiple pending
   * requests trying to modify the same field.
   */
  const pendingRequests =
    await prisma.marketerProfileChangeRequest.findMany({
      where: {
        marketerId: user.marketer.id,
        status: "PENDING",
      },
    });

  for (const pending of pendingRequests) {
    if (
      changes.firstName &&
      pending.requestedFirstName !== null
    ) {
      throw new Error(
        "You already have a pending first-name change request"
      );
    }

    if (
      changes.lastName &&
      pending.requestedLastName !== null
    ) {
      throw new Error(
        "You already have a pending last-name change request"
      );
    }

    if (
      changes.email &&
      pending.requestedEmail !== null
    ) {
      throw new Error(
        "You already have a pending email change request"
      );
    }

    if (
      changes.phone &&
      pending.requestedPhone !== null
    ) {
      throw new Error(
        "You already have a pending phone-number change request"
      );
    }
  }

  /**
   * Check uniqueness immediately where possible.
   *
   * The same checks are repeated during approval
   * because another account could claim the value
   * while this request is waiting.
   */
  if (
    requestedEmail !== undefined &&
    requestedEmail !== user.email
  ) {
    const existingEmail =
      await prisma.user.findUnique({
        where: {
          email: requestedEmail,
        },
      });

    if (
      existingEmail &&
      existingEmail.id !== user.id
    ) {
      throw new Error(
        "That email address is already in use"
      );
    }
  }

  if (
    requestedPhone !== undefined &&
    requestedPhone !== null &&
    requestedPhone !== user.phone
  ) {
    const existingPhone =
      await prisma.user.findUnique({
        where: {
          phone: requestedPhone,
        },
      });

    if (
      existingPhone &&
      existingPhone.id !== user.id
    ) {
      throw new Error(
        "That phone number is already in use"
      );
    }
  }

  const request =
    await prisma.marketerProfileChangeRequest.create({
      data: {
        marketerId: user.marketer.id,

        currentFirstName:
          user.firstName,

        currentLastName:
          user.lastName,

        currentEmail:
          user.email,

        currentPhone:
          user.phone,

        requestedFirstName:
          changes.firstName
            ? requestedFirstName
            : null,

        requestedLastName:
          changes.lastName
            ? requestedLastName
            : null,

        requestedEmail:
          changes.email
            ? requestedEmail
            : null,

        requestedPhone:
          changes.phone
            ? requestedPhone
            : null,

        reason:
          reason ?? null,

        status: "PENDING",
      },
    });

  return request;
}

/**
 * Get the authenticated marketer's request history.
 */
export async function getMyMarketerProfileChangeRequests(
  userId: string
) {
  const marketer =
    await prisma.marketer.findUnique({
      where: {
        userId,
      },
    });

  if (!marketer) {
    throw new Error(
      "Marketer profile was not found"
    );
  }

  return prisma.marketerProfileChangeRequest.findMany({
    where: {
      marketerId: marketer.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Get all marketer profile-change requests for admins.
 */
export async function getAllMarketerProfileChangeRequests(
  status?: string
) {
  const validStatuses: MarketerProfileChangeStatus[] = [
    "PENDING",
    "APPROVED",
    "REJECTED",
  ];

  let parsedStatus:
    | MarketerProfileChangeStatus
    | undefined;

  if (status) {
    if (
      !validStatuses.includes(
        status as MarketerProfileChangeStatus
      )
    ) {
      throw new Error(
        "Invalid profile change request status"
      );
    }

    parsedStatus =
      status as MarketerProfileChangeStatus;
  }

  return prisma.marketerProfileChangeRequest.findMany({
    where: parsedStatus
      ? {
          status: parsedStatus,
        }
      : undefined,

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
              role: true,
              isActive: true,
              accountStatus: true,
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
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Approve a pending marketer profile-change request.
 *
 * The User is updated and the request is marked
 * APPROVED in one transaction.
 */
export async function approveMarketerProfileChangeRequest(
  requestId: string,
  adminUserId: string
) {
  const request =
    await prisma.marketerProfileChangeRequest.findUnique({
      where: {
        id: requestId,
      },
      include: {
        marketer: {
          include: {
            user: true,
          },
        },
      },
    });

  if (!request) {
    throw new Error(
      "Profile change request not found"
    );
  }

  if (request.status !== "PENDING") {
    throw new Error(
      "This profile change request has already been reviewed"
    );
  }

  const user =
    request.marketer.user;

  if (!user.isActive) {
    throw new Error(
      "The marketer account is inactive"
    );
  }

  const data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
  } = {};

  if (request.requestedFirstName !== null) {
    data.firstName =
      request.requestedFirstName;
  }

  if (request.requestedLastName !== null) {
    data.lastName =
      request.requestedLastName;
  }

  if (request.requestedEmail !== null) {
    const email =
      request.requestedEmail.toLowerCase();

    const emailOwner =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (
      emailOwner &&
      emailOwner.id !== user.id
    ) {
      throw new Error(
        "The requested email address is now being used by another account"
      );
    }

    data.email = email;
  }

  if (
    request.requestedPhone !== null
  ) {
    const phone =
      request.requestedPhone;

    if (phone) {
      const phoneOwner =
        await prisma.user.findUnique({
          where: {
            phone,
          },
        });

      if (
        phoneOwner &&
        phoneOwner.id !== user.id
      ) {
        throw new Error(
          "The requested phone number is now being used by another account"
        );
      }
    }

    data.phone = phone;
  }

  const reviewedAt = new Date();

  const result =
    await prisma.$transaction(async (tx) => {
      const updatedUser =
        await tx.user.update({
          where: {
            id: user.id,
          },
          data,
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

      const updatedRequest =
        await tx.marketerProfileChangeRequest.update({
          where: {
            id: request.id,
          },
          data: {
            status: "APPROVED",
            reviewedAt,
            reviewedById: adminUserId,
          },
        });

      return {
        updatedUser,
        updatedRequest,
      };
    });

  return result;
}

/**
 * Reject a pending marketer profile-change request.
 *
 * The User account is left unchanged.
 */
export async function rejectMarketerProfileChangeRequest(
  requestId: string,
  adminUserId: string,
  adminNotes: string
) {
  const notes =
    adminNotes.trim();

  if (!notes) {
    throw new Error(
      "A rejection reason is required"
    );
  }

  const request =
    await prisma.marketerProfileChangeRequest.findUnique({
      where: {
        id: requestId,
      },
    });

  if (!request) {
    throw new Error(
      "Profile change request not found"
    );
  }

  if (request.status !== "PENDING") {
    throw new Error(
      "This profile change request has already been reviewed"
    );
  }

  return prisma.marketerProfileChangeRequest.update({
    where: {
      id: request.id,
    },
    data: {
      status: "REJECTED",
      adminNotes: notes,
      reviewedAt: new Date(),
      reviewedById: adminUserId,
    },
  });
}
