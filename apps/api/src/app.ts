import "dotenv/config";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import morgan from "morgan";
import { router } from "./routes/index";

export const app = express();

// Security headers
app.use(helmet());

// Response compression
app.use(compression());

// CORS — restrict origins in production
app.use(
  cors({
    origin:
      process.env["NODE_ENV"] === "production"
        ? [process.env["WEB_URL"] ?? ""].filter(Boolean)
        : "*",
    credentials: true,
  }),
);

// HTTP request logging — silence in test
if (process.env["NODE_ENV"] !== "test") {
  app.use(morgan(process.env["NODE_ENV"] === "production" ? "combined" : "dev"));
}

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/v1", router);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found", code: "NOT_FOUND" });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Error]", err);
  res.status(500).json({
    error:
      process.env["NODE_ENV"] === "production" ? "Internal server error" : err.message,
    code: "INTERNAL_ERROR",
  });
});
