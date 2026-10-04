import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config.js";
import { errorHandler, notFound } from "./lib/http.js";
import { authRouter } from "./modules/auth.js";
import { addressesRouter, customersRouter, productsRouter, zonesRouter } from "./modules/catalogs.js";
import { distributionRouter } from "./modules/distribution.js";
import { messagingRouter } from "./modules/messaging.js";
import { dashboardRouter, notificationsRouter, requestsRouter, trackingRouter } from "./modules/operations.js";
import { usersRouter } from "./modules/users.js";

export const app = express();
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_request, response) => response.json({ status: "ok", service: "viteg-api" }));
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/users", usersRouter);
app.use("/api/customers", customersRouter);
app.use("/api/addresses", addressesRouter);
app.use("/api/products", productsRouter);
app.use("/api/zones", zonesRouter);
app.use("/api/distribution", distributionRouter);
app.use("/api/address-requests", requestsRouter);
app.use("/api/tracking", trackingRouter);
app.use("/api/messaging", messagingRouter);
app.use("/api/notifications", notificationsRouter);
app.use(notFound);
app.use(errorHandler);

