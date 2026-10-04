import { Router } from "express";
import { z } from "zod";
import { AppError, asyncHandler } from "../lib/http.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import {
  AddressRequest,
  Customer,
  CustomerAddress,
  Delivery,
  DriverLocation,
  Notification,
  Route,
  User
} from "../models/index.js";

const requestSchema = z.object({
  customerData: z.object({
    type: z.enum(["PARTICULAR", "NEGOCIO", "EMPRESA"]),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    businessName: z.string().optional(),
    phone: z.string().min(7)
  }),
  addressData: z.object({
    alias: z.string().min(2),
    street: z.string().min(2),
    exteriorNumber: z.string().min(1),
    neighborhood: z.string().min(2),
    city: z.string().min(2),
    state: z.string().min(2),
    postalCode: z.string().optional(),
    reference: z.string().optional()
  }),
  coordinates: z.object({ latitude: z.number(), longitude: z.number() }),
  notes: z.string().optional(),
  photos: z.array(z.object({ url: z.string(), storageKey: z.string().optional(), kind: z.literal("IMAGE").default("IMAGE") })).default([])
});

const locationSchema = z.object({
  routeId: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  speed: z.number().optional(),
  heading: z.number().min(0).max(360).optional(),
  recordedAt: z.coerce.date().default(() => new Date())
});

export const requestsRouter = Router();
requestsRouter.use(requireAuth);

requestsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const filter = request.user!.role === "DRIVER"
      ? { tenantId: "default", requestedBy: request.user!.id }
      : { tenantId: "default" };
    const requests = await AddressRequest.find(filter)
      .populate("requestedBy", "firstName lastName")
      .sort({ createdAt: -1 });
    response.json({ data: requests });
  })
);

requestsRouter.post(
  "/",
  allowRoles("DRIVER"),
  asyncHandler(async (request, response) => {
    const input = requestSchema.parse(request.body);
    const document = await AddressRequest.create({
      ...input,
      tenantId: "default",
      requestedBy: request.user!.id
    });
    const admins = await User.find({ tenantId: "default", role: "ADMIN", status: "ACTIVE" }).select("_id");
    await Notification.insertMany(
      admins.map((admin: any) => ({
        tenantId: "default",
        userId: admin._id,
        type: "ADDRESS_REQUESTED",
        title: "Nueva solicitud de domicilio",
        body: input.customerData.businessName || `${input.customerData.firstName ?? ""} ${input.customerData.lastName ?? ""}`.trim(),
        entityType: "AddressRequest",
        entityId: document._id
      }))
    );
    response.status(201).json({ data: document });
  })
);

requestsRouter.patch(
  "/:id/review",
  allowRoles("ADMIN"),
  asyncHandler(async (request, response) => {
    const input = z.object({ status: z.enum(["APPROVED", "REJECTED"]), rejectionReason: z.string().optional() }).parse(request.body);
    const document = await AddressRequest.findOne({ _id: request.params.id, tenantId: "default", status: "PENDING" });
    if (!document) throw new AppError(404, "Solicitud pendiente no encontrada");
    if (input.status === "REJECTED" && !input.rejectionReason) {
      throw new AppError(400, "Indica el motivo del rechazo");
    }

    if (input.status === "APPROVED") {
      const customer = await Customer.create({ ...document.customerData.toObject(), tenantId: "default", status: "ACTIVE" });
      const address = await CustomerAddress.create({
        ...document.addressData.toObject(),
        tenantId: "default",
        customerId: customer._id,
        location: document.coordinates,
        status: "ACTIVE"
      });
      document.resultingCustomerId = customer._id;
      document.resultingAddressId = address._id;
    }
    document.status = input.status;
    document.rejectionReason = input.rejectionReason;
    document.reviewedBy = request.user!.id as any;
    document.reviewedAt = new Date();
    await document.save();
    await Notification.create({
      tenantId: "default",
      userId: document.requestedBy,
      type: `ADDRESS_${input.status}`,
      title: input.status === "APPROVED" ? "Domicilio aprobado" : "Domicilio rechazado",
      body: input.rejectionReason,
      entityType: "AddressRequest",
      entityId: document._id
    });
    response.json({ data: document });
  })
);

export const trackingRouter = Router();
trackingRouter.use(requireAuth);

trackingRouter.post(
  "/locations",
  allowRoles("DRIVER"),
  asyncHandler(async (request, response) => {
    const input = locationSchema.parse(request.body);
    const route = await Route.findOne({
      _id: input.routeId,
      tenantId: "default",
      driverId: request.user!.id,
      status: { $in: ["IN_PROGRESS", "PAUSED"] }
    });
    if (!route) throw new AppError(403, "El tracking solo se permite durante una ruta activa");
    const location = await DriverLocation.create({ ...input, tenantId: "default", driverId: request.user!.id });
    response.status(201).json({ data: location });
  })
);

trackingRouter.get(
  "/locations/latest",
  allowRoles("ADMIN"),
  asyncHandler(async (_request, response) => {
    const rows = await DriverLocation.aggregate([
      { $match: { tenantId: "default" } },
      { $sort: { recordedAt: -1 } },
      { $group: { _id: "$driverId", location: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$location" } }
    ]);
    await DriverLocation.populate(rows, { path: "driverId", select: "firstName lastName phone" });
    response.json({ data: rows });
  })
);

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get(
  "/summary",
  asyncHandler(async (request, response) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const driverScope = request.user!.role === "DRIVER" ? { driverId: request.user!.id } : {};
    const [routesToday, activeDrivers, completedDeliveries, totalDeliveries, failedDeliveries, pendingRequests] = await Promise.all([
      Route.countDocuments({ tenantId: "default", date: { $gte: start, $lt: end }, ...driverScope }),
      User.countDocuments({ tenantId: "default", role: "DRIVER", status: "ACTIVE" }),
      Delivery.countDocuments({ tenantId: "default", deliveredAt: { $gte: start, $lt: end }, status: "COMPLETED", ...driverScope }),
      Delivery.countDocuments({ tenantId: "default", deliveredAt: { $gte: start, $lt: end }, ...driverScope }),
      Delivery.countDocuments({ tenantId: "default", deliveredAt: { $gte: start, $lt: end }, status: "FAILED", ...driverScope }),
      AddressRequest.countDocuments({ tenantId: "default", status: "PENDING", ...(request.user!.role === "DRIVER" ? { requestedBy: request.user!.id } : {}) })
    ]);
    response.json({
      data: {
        routesToday,
        activeDrivers,
        completedDeliveries,
        totalDeliveries,
        pendingDeliveries: Math.max(totalDeliveries - completedDeliveries - failedDeliveries, 0),
        failedDeliveries,
        pendingRequests
      }
    });
  })
);

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const notifications = await Notification.find({ tenantId: "default", userId: request.user!.id }).sort({ createdAt: -1 }).limit(50);
    response.json({ data: notifications });
  })
);
notificationsRouter.patch(
  "/:id/read",
  asyncHandler(async (request, response) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: request.params.id, tenantId: "default", userId: request.user!.id },
      { readAt: new Date() },
      { new: true }
    );
    if (!notification) throw new AppError(404, "Notificación no encontrada");
    response.json({ data: notification });
  })
);

