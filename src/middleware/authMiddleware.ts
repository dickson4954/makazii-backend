import type { NextFunction, Request, Response } from "express";

import type { UserRole } from "@prisma/client";

import {
verifyAccessToken,
} from "../services/authService";

import prisma from "../config/prisma";

export interface AuthenticatedUser {
userId: string;
role: UserRole;
email: string;
}

export type AuthenticatedRequest = Request;

/**

* Require a valid MAKAZII access token.
*
* Expected header:
* Authorization: Bearer <jwt>
*
* If the token is valid, decoded user information
* is attached to req.user and the request continues.
  */
  export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
  ) {
  try {
  const authorization = req.headers.authorization;

  if (!authorization) {
  return res.status(401).json({
  success: false,
  message: "Authentication required",
  });
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
  return res.status(401).json({
  success: false,
  message: "Invalid authorization header",
  });
  }

  const decoded = verifyAccessToken(token);

  req.user = {
  userId: decoded.userId,
  role: decoded.role,
  email: decoded.email,
  };

  return next();
  } catch (error) {
  console.error("Authentication middleware error:", error);

  return res.status(401).json({
  success: false,
  message:
  error instanceof Error
  ? error.message
  : "Invalid or expired authentication token",
  });
  }
  }

/**

* Require one of the specified roles.
  */
  export function requireRole(...allowedRoles: UserRole[]) {
  return (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
  ) => {
  if (!req.user) {
  return res.status(401).json({
  success: false,
  message: "Authentication required",
  });
  }

  if (!allowedRoles.includes(req.user.role)) {
  return res.status(403).json({
  success: false,
  message: "You do not have permission to access this resource",
  });
  }

  return next();
  };
  }

/**

* Require ADMIN access.
  */
  export const requireAdmin = requireRole("ADMIN");

/**

* Require MARKETER role.
  */
  export const requireMarketer = requireRole("MARKETER");

/**

* Require CUSTOMER/RENTER access.
  */
  export const requireCustomer = requireRole("RENTER");

/**

* Require either ADMIN or STAFF access.
  */
  export const requireAdminOrStaff = requireRole("ADMIN", "STAFF");

/**

* Require management access.
  */
  export const requireManagement = requireRole("ADMIN", "STAFF");

/**

* Require a marketer account that has been activated and approved.
*
* This checks the database on every protected request so an inactive
* marketer cannot continue using an old access token.
*
* Apply after requireAuth and requireMarketer on operational routes.
* Do not apply to public application submission or status routes.
  */
  export async function requireActiveMarketer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
  ) {
  if (!req.user || req.user.role !== "MARKETER") {
  return res.status(403).json({
  success: false,
  code: "MARKETER_ACCESS_DENIED",
  message: "Marketer access is required.",
  });
  }

try {
const user = await prisma.user.findUnique({
where: {
id: req.user.userId,
},
select: {
role: true,
isActive: true,
accountStatus: true,
},
});

if (
  !user ||
  user.role !== "MARKETER" ||
  !user.isActive ||
  user.accountStatus !== "ACTIVE"
) {
  return res.status(403).json({
    success: false,
    code: "MARKETER_ACCOUNT_INACTIVE",
    message: "Your marketer account is not active or approved.",
  });
}

return next();

} catch (error) {
console.error("Active marketer check failed:", error);

return res.status(500).json({
  success: false,
  message: "Unable to verify marketer account status.",
});

}
}
