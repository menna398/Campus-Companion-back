import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { connectDB } from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";
import profileRoutes from "./src/routes/profileRoutes.js";
import resourceRoutes from "./src/routes/resourceRoutes.js";
import migrationRoutes from "./src/routes/migrationRoutes.js";
import dashboardRoutes from "./src/routes/dashboardRoutes.js";
import debugRoutes from "./src/routes/debugRoutes.js";

const app = express();

/*
 * =========================================
 * CORS
 * =========================================
 *
 * Allowed origins = defaults below + CLIENT_URL (comma-separated, optional).
 * Trailing slashes are ignored.
 */

const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "");

const defaultOrigins = [
  "http://localhost:5173",
  "https://campus-companion-blush.vercel.app",
];

const allowedOrigins = [
  ...new Set(
    [...defaultOrigins, ...(process.env.CLIENT_URL || "").split(",")]
      .map(normalizeOrigin)
      .filter(Boolean),
  ),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin = Postman / server-to-server requests.
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

/*
 * =========================================
 * HEALTH (works even if the database is down)
 * =========================================
 */

app.get("/", (_req, res) =>
  res.json({ status: "ok", service: "Campus Companion API" }),
);

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "Campus Companion API" }),
);

/*
 * =========================================
 * DATABASE (connected once, reused between requests)
 * =========================================
 *
 * On Vercel the app runs as a serverless function, so the connection is
 * opened lazily on the first request instead of before app.listen().
 */

let dbPromise = null;

function ensureDB() {
  if (!dbPromise) {
    dbPromise = connectDB().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}

app.use(async (_req, _res, next) => {
  try {
    await ensureDB();
    next();
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    next(error);
  }
});

/*
 * =========================================
 * ROUTES
 * =========================================
 */

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api", resourceRoutes);
app.use("/api/migration", migrationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/debug", debugRoutes);

app.use((req, res) =>
  res
    .status(404)
    .json({ message: `Route not found: ${req.method} ${req.originalUrl}` }),
);

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || (error.name === "ValidationError" ? 400 : 500);
  res.status(status).json({
    message: status === 500 ? "Internal server error." : error.message,
  });
});

/*
 * =========================================
 * START
 * =========================================
 *
 * Locally: connect, then listen.
 * On Vercel: the platform calls the exported app, no listen().
 */

if (!process.env.VERCEL) {
  const port = process.env.PORT || 5000;

  try {
    await ensureDB();
    app.listen(port, () =>
      console.log(`Campus Companion API running on http://localhost:${port}`),
    );
  } catch (error) {
    console.error(`Could not start server: ${error.message}`);
    process.exit(1);
  }
}

export default app;
