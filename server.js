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
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "Campus Companion API" }),
);
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
  res
    .status(status)
    .json({
      message: status === 500 ? "Internal server error." : error.message,
    });
});

const port = process.env.PORT || 5000;
try {
  await connectDB();
  app.listen(port, () =>
    console.log(`Campus Companion API running on http://localhost:${port}`),
  );
} catch (error) {
  console.error(`Could not start server: ${error.message}`);
  process.exit(1);
}
