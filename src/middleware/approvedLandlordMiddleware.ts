import type { NextFunction, Request, Response } from "express";

import prisma from "../config/prisma";

export async function requireApprovedLandlord(
req: Request,
res: Response,
next: NextFunction,
) {
try {
const userId = req.user?.userId;

if (!userId || req.user?.role !== "LANDLORD") {
  return res.status(403).json({
    success: false,
    code: "LANDLORD_ACCESS_REQUIRED",
    message: "Landlord access is required.",
  });
}

const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    accountStatus: true,
    isActive: true,
    landlord: {
      select: {
        applicationStatus: true,
        idVerificationStatus: true,
      },
    },
  },
});

if (!user || !user.isActive || user.accountStatus !== "ACTIVE") {
  return res.status(403).json({
    success: false,
    code: "LANDLORD_ACCOUNT_INACTIVE",
    message: "Your account is inactive or restricted. Please contact support.",
  });
}

if (!user.landlord) {
  return res.status(403).json({
    success: false,
    code: "LANDLORD_APPLICATION_NOT_FOUND",
    message: "Your landlord application could not be found.",
  });
}

if (user.landlord.applicationStatus !== "APPROVED") {
  return res.status(403).json({
    success: false,
    code: "LANDLORD_APPLICATION_NOT_APPROVED",
    applicationStatus: user.landlord.applicationStatus,
    idVerificationStatus: user.landlord.idVerificationStatus,
    message: "Your landlord application must be approved before dashboard access is allowed.",
  });
}

if (user.landlord.idVerificationStatus !== "VERIFIED") {
  return res.status(403).json({
    success: false,
    code: "LANDLORD_ID_NOT_VERIFIED",
    applicationStatus: user.landlord.applicationStatus,
    idVerificationStatus: user.landlord.idVerificationStatus,
    message: "Your identification must be verified before dashboard access is allowed.",
  });
}

return next();

} catch (error) {
console.error("Approved landlord access check failed:", error);

return res.status(500).json({
  success: false,
  message: "Unable to verify landlord dashboard access.",
});

}
}
