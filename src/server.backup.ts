import "dotenv/config";
import express from "express";
import cors from "cors";

import prisma from "./config/prisma";

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

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "MAKAZII API is running",
  });
});

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

app.listen(PORT, () => {
  console.log(`MAKAZII API running on port ${PORT}`);
});

