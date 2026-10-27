import { Router } from "express";
import { z } from "zod";
import { canTransitionRoute, type DeliveryStatus, type RouteStatus } from "@viteg/shared";
import { AppError, asyncHandler } from "../lib/http.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { Delivery, Notification, Route, RouteStop } from "../models/index.js";
import { User } from "../models/index.js";
import { recordActivity } from "../lib/activity.js";

const createRouteSchema = z.object({
  name: z.string().min(3),
  date: z.coerce.date(),
  zoneId: z.string().optional(),
  driverId: z.string().nullable().optional(),
  origin: z.object({ label: z.string().min(2), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).optional(),
  destination: z.object({ label: z.string().min(2), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).optional(),
  waypoints: z.array(z.object({
    label: z.string().min(2),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    customerId: z.string().optional(),
    addressId: z.string().optional(),
    items: z.array(z.object({
      productId: z.string(),
      expectedQuantity: z.number().positive()
    })).default([]),
    priority: z.number().min(0).max(100).default(0)
  })).max(23).default([]),
  vehicleLabel: z.string().optional(),
  startTime: z.string().optional(),
  estimatedReturnTime: z.string().optional(),
  recurrence: z.object({
    enabled: z.boolean().default(false),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    endsAt: z.coerce.date().nullable().optional()
  }).optional()
});

const updateRouteSchema = createRouteSchema.partial();

const stopSchema = z.object({
  customerId: z.string(),
  addressId: z.string(),
  sequence: z.number().int().positive(),
  priority: z.number().min(0).max(100).default(50),
  scheduledTime: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string(),
      expectedQuantity: z.number().nonnegative()
    })
  ).min(1)
});

const deliverySchema = z.object({
  status: z.enum(["COMPLETED", "PARTIAL", "FAILED"]),
  items: z.array(z.object({ productId: z.string(), expectedQuantity: z.number(), deliveredQuantity: z.number().nonnegative() })),
  failureReason: z.enum(["CLIENTE_AUSENTE", "CLIENTE_RECHAZO", "DIRECCION_INCORRECTA", "PRODUCTO_INSUFICIENTE", "NEGOCIO_CERRADO", "VEHICULO", "OTRO"]).optional(),
  notes: z.string().optional(),
  coordinates: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  evidence: z.array(z.object({ url: z.string(), storageKey: z.string().optional(), kind: z.enum(["IMAGE", "DOCUMENT"]).default("IMAGE") })).default([])
});

function scopedRouteQuery(user: Express.Request["user"]) {
  return user?.role === "DRIVER" ? { tenantId: "default", driverId: user.id } : { tenantId: "default" };
}

export function nextRecurringDate(current: Date, weekdays: number[], endsAt?: Date | null) {
  if (!weekdays.length) return null;
  const next = new Date(current);
  for (let offset = 1; offset <= 14; offset += 1) {
    next.setDate(next.getDate() + 1);
    if (weekdays.includes(next.getDay())) {
      if (endsAt && next > endsAt) return null;
      return new Date(next);
    }
  }
  return null;
}

export const distributionRouter = Router();
distributionRouter.use(requireAuth);

distributionRouter.get(
  "/routes",
  asyncHandler(async (request, response) => {
    const routes = await Route.find(scopedRouteQuery(request.user))
      .populate("driverId", "firstName lastName phone")
      .populate("zoneId")
      .populate("waypoints.customerId", "businessName firstName lastName phone")
      .populate("waypoints.addressId", "alias street reference location")
      .populate("waypoints.items.productId", "code name category unit logisticsPriority")
      .sort({ date: -1 });
    response.json({ data: routes });
  })
);

distributionRouter.post(
  "/routes",
  allowRoles("ADMIN"),
  asyncHandler(async (request, response) => {
    const input = createRouteSchema.parse(request.body);
    const route = await Route.create({
      ...input,
      tenantId: "default",
      status: input.driverId ? "ASSIGNED" : "DRAFT",
      createdBy: request.user!.id
    });
    if (route.recurrence?.enabled) {
      route.recurrence.seriesId = route._id;
      await route.save();
    }
    if (input.driverId) {
      await Notification.create({
        tenantId: "default",
        userId: input.driverId,
        type: "ROUTE_ASSIGNED",
        title: "Nueva ruta asignada",
        body: input.name,
        entityType: "Route",
        entityId: route._id
      });
    }
    const assignedDriver = input.driverId
      ? await User.findOne({ _id: input.driverId, tenantId: "default" }).select("firstName lastName").lean()
      : null;
    const driverName = assignedDriver ? `${assignedDriver.firstName} ${assignedDriver.lastName}`.trim() : "";
    await recordActivity({
      actor: request.user!, action: input.driverId ? "ASSIGN" : "CREATE", entityType: "Route", entityId: route._id,
      entityLabel: route.name, targetUserId: input.driverId,
      summary: input.driverId ? `creó y asignó la ruta “${route.name}” a ${driverName}` : `creó la ruta “${route.name}”`
    });
    response.status(201).json({ data: route });
  })
);

distributionRouter.patch(
  "/routes/:routeId",
  allowRoles("ADMIN"),
  asyncHandler(async (request, response) => {
    const input = updateRouteSchema.parse(request.body);
    const route = await Route.findOne({ _id: request.params.routeId, tenantId: "default" });
    if (!route) throw new AppError(404, "Ruta no encontrada");
    if (!["DRAFT", "SCHEDULED", "ASSIGNED"].includes(route.status)) {
      throw new AppError(409, "Solo se pueden editar rutas que todavía no han iniciado");
    }

    const previousDriverId = route.driverId?.toString();
    Object.assign(route, input);
    if (Object.hasOwn(input, "driverId")) {
      route.driverId = input.driverId || undefined;
      route.status = input.driverId ? "ASSIGNED" : "DRAFT";
    }
    await route.save();
    if (route.recurrence?.enabled && !route.recurrence.seriesId) {
      route.recurrence.seriesId = route._id;
      await route.save();
    }

    if (input.driverId && input.driverId !== previousDriverId) {
      await Notification.create({
        tenantId: "default",
        userId: input.driverId,
        type: "ROUTE_ASSIGNED",
        title: "Ruta asignada",
        body: route.name,
        entityType: "Route",
        entityId: route._id
      });
    }

    await route.populate("driverId", "firstName lastName phone");
    const driverName = route.driverId ? `${route.driverId.firstName ?? ""} ${route.driverId.lastName ?? ""}`.trim() : "";
    await recordActivity({
      actor: request.user!, action: input.driverId && input.driverId !== previousDriverId ? "ASSIGN" : "UPDATE",
      entityType: "Route", entityId: route._id, entityLabel: route.name, targetUserId: input.driverId,
      summary: input.driverId && input.driverId !== previousDriverId
        ? `asignó la ruta “${route.name}” a ${driverName}`
        : `editó la ruta “${route.name}”`
    });
    response.json({ data: route, message: "Ruta actualizada" });
  })
);

distributionRouter.delete(
  "/routes/:routeId",
  allowRoles("ADMIN"),
  asyncHandler(async (request, response) => {
    const route = await Route.findOne({ _id: request.params.routeId, tenantId: "default" });
    if (!route) throw new AppError(404, "Ruta no encontrada");
    if (!["DRAFT", "SCHEDULED", "ASSIGNED", "CANCELLED"].includes(route.status)) {
      throw new AppError(409, "No se puede eliminar una ruta iniciada o completada");
    }
    await RouteStop.deleteMany({ routeId: route._id, tenantId: "default" });
    await route.deleteOne();
    await recordActivity({
      actor: request.user!, action: "DELETE", entityType: "Route", entityId: route._id,
      entityLabel: route.name, summary: `eliminó la ruta “${route.name}”`
    });
    response.json({ data: { id: String(route._id) }, message: "Ruta eliminada" });
  })
);

distributionRouter.get(
  "/routes/:routeId/stops",
  asyncHandler(async (request, response) => {
    const route = await Route.findOne({ _id: request.params.routeId, ...scopedRouteQuery(request.user) });
    if (!route) throw new AppError(404, "Ruta no encontrada");
    const stops = await RouteStop.find({ routeId: route._id, tenantId: "default" })
      .populate("customerId addressId items.productId")
      .sort({ sequence: 1 });
    response.json({ data: stops });
  })
);

distributionRouter.post(
  "/routes/:routeId/stops",
  allowRoles("ADMIN"),
  asyncHandler(async (request, response) => {
    const input = stopSchema.parse(request.body);
    const route = await Route.findOne({ _id: request.params.routeId, tenantId: "default" });
    if (!route) throw new AppError(404, "Ruta no encontrada");
    if (["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(route.status)) {
      throw new AppError(409, "No se pueden agregar paradas en el estado actual");
    }
    const stop = await RouteStop.create({ ...input, routeId: route._id, tenantId: "default" });
    route.stopCount = await RouteStop.countDocuments({ routeId: route._id });
    await route.save();
    await recordActivity({
      actor: request.user!, action: "CREATE", entityType: "RouteStop", entityId: stop._id,
      entityLabel: `Parada ${input.sequence}`, summary: `añadió la parada ${input.sequence} a la ruta “${route.name}”`
    });
    response.status(201).json({ data: stop });
  })
);

distributionRouter.patch(
  "/routes/:routeId/status",
  asyncHandler(async (request, response) => {
    const { status } = z.object({ status: z.enum(["DRAFT", "SCHEDULED", "ASSIGNED", "IN_PROGRESS", "PAUSED", "COMPLETED", "CANCELLED"]) }).parse(request.body);
    const route = await Route.findOne({ _id: request.params.routeId, ...scopedRouteQuery(request.user) });
    if (!route) throw new AppError(404, "Ruta no encontrada");
    if (request.user!.role === "DRIVER" && !["IN_PROGRESS", "PAUSED", "COMPLETED"].includes(status)) {
      throw new AppError(403, "El repartidor no puede realizar esa transición");
    }
    if (!canTransitionRoute(route.status as RouteStatus, status)) {
      throw new AppError(409, `Transición no permitida: ${route.status} → ${status}`);
    }
    route.status = status;
    if (status === "IN_PROGRESS" && !route.startedAt) route.startedAt = new Date();
    if (status === "COMPLETED") route.completedAt = new Date();
    await route.save();
    if (status === "COMPLETED" && route.recurrence?.enabled) {
      const nextDate = nextRecurringDate(
        new Date(route.date),
        Array.from(route.recurrence.weekdays ?? []),
        route.recurrence.endsAt ? new Date(route.recurrence.endsAt) : null
      );
      if (nextDate) {
        const seriesId = route.recurrence.seriesId ?? route._id;
        const existing = await Route.findOne({ tenantId: "default", "recurrence.seriesId": seriesId, date: nextDate });
        if (!existing) {
          const clone = route.toObject();
          delete clone._id;
          delete clone.createdAt;
          delete clone.updatedAt;
          delete clone.startedAt;
          delete clone.completedAt;
          clone.date = nextDate;
          clone.status = clone.driverId ? "ASSIGNED" : "DRAFT";
          clone.completedStopCount = 0;
          clone.recurrence = { ...clone.recurrence, seriesId };
          const nextRoute = await Route.create(clone);
          if (clone.driverId) {
            await Notification.create({
              tenantId: "default", userId: clone.driverId, type: "ROUTE_ASSIGNED",
              title: "Siguiente ruta recurrente", body: clone.name, entityType: "Route", entityId: nextRoute._id
            });
          }
          await recordActivity({
            actor: request.user!, action: "CREATE", entityType: "Route", entityId: nextRoute._id,
            entityLabel: clone.name, targetUserId: clone.driverId,
            summary: `generó automáticamente la siguiente jornada de la ruta fija “${clone.name}”`
          });
        }
      }
    }
    await recordActivity({
      actor: request.user!, action: "STATUS", entityType: "Route", entityId: route._id,
      entityLabel: route.name, summary: `cambió la ruta “${route.name}” al estado ${status.replaceAll("_", " ").toLowerCase()}`
    });
    response.json({ data: route });
  })
);

distributionRouter.patch(
  "/stops/:stopId/arrival",
  allowRoles("DRIVER"),
  asyncHandler(async (request, response) => {
    const stop = await RouteStop.findOne({ _id: request.params.stopId, tenantId: "default" });
    if (!stop) throw new AppError(404, "Parada no encontrada");
    const route = await Route.findOne({ _id: stop.routeId, driverId: request.user!.id, status: "IN_PROGRESS" });
    if (!route) throw new AppError(403, "La parada no pertenece a tu ruta activa");
    stop.status = "ARRIVED";
    stop.arrivedAt = new Date();
    await stop.save();
    response.json({ data: stop });
  })
);

distributionRouter.post(
  "/stops/:stopId/delivery",
  allowRoles("DRIVER"),
  asyncHandler(async (request, response) => {
    const input = deliverySchema.parse(request.body);
    const stop = await RouteStop.findOne({ _id: request.params.stopId, tenantId: "default" });
    if (!stop) throw new AppError(404, "Parada no encontrada");
    const route = await Route.findOne({ _id: stop.routeId, driverId: request.user!.id, status: "IN_PROGRESS" });
    if (!route) throw new AppError(403, "La parada no pertenece a tu ruta activa");
    if (["DELIVERED", "PARTIALLY_DELIVERED", "FAILED"].includes(stop.status)) {
      throw new AppError(409, "La parada ya fue cerrada");
    }

    const delivery = await Delivery.create({
      ...input,
      tenantId: "default",
      routeId: route._id,
      routeStopId: stop._id,
      driverId: request.user!.id,
      customerId: stop.customerId,
      addressId: stop.addressId,
      deliveredAt: new Date()
    });
    const stopStatus = input.status === "COMPLETED" ? "DELIVERED" : input.status === "PARTIAL" ? "PARTIALLY_DELIVERED" : "FAILED";
    stop.status = stopStatus;
    stop.completedAt = new Date();
    stop.items = input.items as any;
    await stop.save();
    route.completedStopCount = await RouteStop.countDocuments({
      routeId: route._id,
      status: { $in: ["DELIVERED", "PARTIALLY_DELIVERED", "FAILED", "SKIPPED"] }
    });
    await route.save();
    await recordActivity({
      actor: request.user!, action: "DELIVERY", entityType: "Delivery", entityId: delivery._id,
      entityLabel: route.name, summary: `registró una entrega ${input.status.toLowerCase()} en la ruta “${route.name}”`
    });
    response.status(201).json({ data: delivery });
  })
);

distributionRouter.get(
  "/deliveries",
  asyncHandler(async (request, response) => {
    const filter = request.user!.role === "DRIVER" ? { tenantId: "default", driverId: request.user!.id } : { tenantId: "default" };
    const deliveries = await Delivery.find(filter)
      .populate("driverId", "firstName lastName")
      .populate("customerId addressId items.productId")
      .sort({ deliveredAt: -1 });
    response.json({ data: deliveries });
  })
);
