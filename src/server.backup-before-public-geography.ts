import "dotenv/config";
import express from "express";
import cors from "cors";

import prisma from "./config/prisma";
import authRoutes from "./routes/authRoutes";
import marketerRoutes from "./routes/marketerRoutes";
import geographyRoutes from "./routes/geographyRoutes";

const app = express();

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * AUTH ROUTES
 *
 * Login, current user, etc.
 */
app.use("/api/auth", authRoutes);

/**
 * ADMIN → MARKETERS
 *
 * All routes inside marketerRoutes are protected
 * by requireAuth + requireAdmin.
 *
 * POST   /api/admin/marketers
 * GET    /api/admin/marketers
 * GET    /api/admin/marketers/:id
 * PATCH  /api/admin/marketers/:id/approve
 * PATCH  /api/admin/marketers/:id/deactivate
 *
 * GET    /api/admin/marketers/:id/places
 * POST   /api/admin/marketers/:id/places
 * DELETE /api/admin/marketers/:id/places/:placeId
 */
app.use("/api/admin/marketers", marketerRoutes);

/**
 * ADMIN → GEOGRAPHY
 *
 * Counties and places used to organize
 * marketers and properties.
 *
 * GET  /api/admin/counties
 * POST /api/admin/counties
 * GET  /api/admin/counties/:countyId/places
 * POST /api/admin/counties/:countyId/places
 */
app.use("/api/admin/counties", geographyRoutes);

/**
 * ROOT
 */
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "MAKAZII API is running",
  });
});

/**
 * DATABASE HEALTH CHECK
 */
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "MAKAZII backend is healthy",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      success: false,
      message: "MAKAZII backend is running, but database connection failed",
      database: "disconnected",
    });
  }
});

/**
 * START SERVER
 */
app.listen(PORT, () => {
  console.log(`MAKAZII API running on port ${PORT}`);
});
