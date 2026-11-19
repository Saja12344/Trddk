import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import express from "express";
import cors from "cors";

import authRouter from "./routes/auth";
import businessesRouter from "./routes/businesses";
import routesRouter from "./routes/routes";
import busesRouter from "./routes/buses";
import driversRouter from "./routes/drivers";
import tripsRouter from "./routes/trips";
import gpsRouter from "./routes/gps";
import remindersRouter from "./routes/reminders";
import usersRouter from "./routes/users";
import { navigationRouter } from "./routes/routing";
import { attachAdminAuth } from "./auth/middleware";
import { closeStaleTrips } from "./jobs/closeStaleTrips";
import { isAllowedApiOrigin } from "./http/corsPolicy";

const adminJwtSecret = defineSecret("ADMIN_JWT_SECRET");
const smtpHost = defineSecret("SMTP_HOST");
const smtpPort = defineSecret("SMTP_PORT");
const smtpUser = defineSecret("SMTP_USER");
const smtpPassword = defineSecret("SMTP_PASSWORD");
const smtpFrom = defineSecret("SMTP_FROM");
const googleRoutesApiKey = defineSecret("GOOGLE_ROUTES_API_KEY");

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedApiOrigin(origin));
    },
  })
);
app.use(express.json());
app.use(attachAdminAuth);

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", service: "tardadi-api" } });
});

app.use("/api/auth", authRouter);
app.use("/api/businesses", businessesRouter);
app.use("/api/routes", routesRouter);
app.use("/api/buses", busesRouter);
app.use("/api/drivers", driversRouter);
app.use("/api/trips", tripsRouter);
app.use("/api/gps", gpsRouter);
app.use("/api/reminders", remindersRouter);
app.use("/api/users", usersRouter);
app.use("/api/routing", navigationRouter);

export const closeInactiveTrips = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    await closeStaleTrips();
  }
);

export const api = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    cpu: 1,
    timeoutSeconds: 60,
    maxInstances: 3,
    concurrency: 80,
    cors: false,
    invoker: "public",
    secrets: [
      adminJwtSecret,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpFrom,
      googleRoutesApiKey,
    ],
  },
  app
);
