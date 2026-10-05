import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const options = { timestamps: true, versionKey: false } as const;
const pointFields = {
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 }
};
const routeEndpointSchema = new Schema(
  {
    label: { type: String, required: true },
    latitude: { type: Number, min: -90, max: 90, required: true },
    longitude: { type: Number, min: -180, max: 180, required: true }
  },
  { _id: false }
);
const routeWaypointItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    expectedQuantity: { type: Number, min: 0.01, required: true }
  },
  { _id: false }
);
const routeWaypointSchema = new Schema(
  {
    label: { type: String, required: true },
    latitude: { type: Number, min: -90, max: 90, required: true },
    longitude: { type: Number, min: -180, max: 180, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    addressId: { type: Schema.Types.ObjectId, ref: "CustomerAddress" },
    items: { type: [routeWaypointItemSchema], default: [] },
    priority: { type: Number, min: 0, max: 100, default: 0 }
  },
  { _id: false }
);
const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    storageKey: String,
    kind: { type: String, enum: ["IMAGE", "DOCUMENT"], default: "IMAGE" }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["ADMIN", "DRIVER"], required: true },
    status: { type: String, enum: ["PENDING", "ACTIVE", "SUSPENDED", "INACTIVE"], default: "PENDING" },
    employeeNumber: String,
    photoUrl: String,
    licenseNumber: String,
    licenseExpiresAt: Date,
    lastAccessAt: Date
  },
  options
);
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

const customerSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    type: { type: String, enum: ["PARTICULAR", "NEGOCIO", "EMPRESA"], required: true },
    firstName: String,
    lastName: String,
    businessName: String,
    phone: { type: String, required: true },
    alternatePhone: String,
    email: String,
    notes: String,
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" }
  },
  options
);

const addressSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    alias: { type: String, required: true },
    street: { type: String, required: true },
    exteriorNumber: { type: String, required: true },
    interiorNumber: String,
    neighborhood: { type: String, required: true },
    postalCode: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    reference: String,
    location: pointFields,
    zoneId: { type: Schema.Types.ObjectId, ref: "Zone" },
    deliveryInstructions: String,
    preferredWindow: { start: String, end: String },
    status: { type: String, enum: ["ACTIVE", "PENDING", "INACTIVE", "REJECTED"], default: "ACTIVE" }
  },
  options
);

const productSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    description: String,
    category: { type: String, enum: ["AGUA", "HIELO", "BEBIDAS", "ACCESORIOS", "OTROS"], required: true },
    price: { type: Number, min: 0, required: true },
    unit: { type: String, required: true },
    logisticsPriority: { type: Number, min: 0, max: 100, default: 50 },
    isActive: { type: Boolean, default: true }
  },
  options
);
productSchema.index({ tenantId: 1, code: 1 }, { unique: true });

const zoneSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    name: { type: String, required: true },
    description: String,
    color: { type: String, default: "#2563EB" },
    isActive: { type: Boolean, default: true }
  },
  options
);

const routeSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    name: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: "Zone" },
    driverId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    origin: routeEndpointSchema,
    destination: routeEndpointSchema,
    waypoints: { type: [routeWaypointSchema], default: [] },
    vehicleLabel: String,
    startTime: String,
    estimatedReturnTime: String,
    status: {
      type: String,
      enum: ["DRAFT", "SCHEDULED", "ASSIGNED", "IN_PROGRESS", "PAUSED", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
      index: true
    },
    stopCount: { type: Number, default: 0 },
    completedStopCount: { type: Number, default: 0 },
    estimatedDistanceKm: Number,
    estimatedDurationMinutes: Number,
    startedAt: Date,
    completedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  options
);

const itemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    expectedQuantity: { type: Number, min: 0, required: true },
    deliveredQuantity: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

const stopSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    routeId: { type: Schema.Types.ObjectId, ref: "Route", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    addressId: { type: Schema.Types.ObjectId, ref: "CustomerAddress", required: true },
    sequence: { type: Number, min: 1, required: true },
    priority: { type: Number, min: 0, max: 100, default: 50 },
    scheduledTime: String,
    items: [itemSchema],
    notes: String,
    status: {
      type: String,
      enum: ["PENDING", "EN_ROUTE", "ARRIVED", "DELIVERED", "PARTIALLY_DELIVERED", "FAILED", "SKIPPED"],
      default: "PENDING"
    },
    arrivedAt: Date,
    completedAt: Date
  },
  options
);
stopSchema.index({ routeId: 1, sequence: 1 }, { unique: true });

const deliverySchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    routeId: { type: Schema.Types.ObjectId, ref: "Route", required: true, index: true },
    routeStopId: { type: Schema.Types.ObjectId, ref: "RouteStop", required: true, unique: true },
    driverId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    addressId: { type: Schema.Types.ObjectId, ref: "CustomerAddress", required: true },
    items: [itemSchema],
    status: { type: String, enum: ["PENDING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"], required: true },
    failureReason: {
      type: String,
      enum: ["CLIENTE_AUSENTE", "CLIENTE_RECHAZO", "DIRECCION_INCORRECTA", "PRODUCTO_INSUFICIENTE", "NEGOCIO_CERRADO", "VEHICULO", "OTRO"]
    },
    notes: String,
    evidence: [attachmentSchema],
    coordinates: pointFields,
    deliveredAt: Date
  },
  options
);

const addressRequestSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerData: {
      type: { type: String, enum: ["PARTICULAR", "NEGOCIO", "EMPRESA"], required: true },
      firstName: String,
      lastName: String,
      businessName: String,
      phone: { type: String, required: true }
    },
    addressData: {
      alias: { type: String, required: true },
      street: { type: String, required: true },
      exteriorNumber: { type: String, required: true },
      neighborhood: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: String,
      reference: String
    },
    coordinates: pointFields,
    notes: String,
    photos: [attachmentSchema],
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"], default: "PENDING", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    rejectionReason: String,
    resultingCustomerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    resultingAddressId: { type: Schema.Types.ObjectId, ref: "CustomerAddress" }
  },
  options
);

const driverLocationSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    driverId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    routeId: { type: Schema.Types.ObjectId, ref: "Route", required: true, index: true },
    ...pointFields,
    accuracy: Number,
    speed: Number,
    heading: Number,
    recordedAt: { type: Date, required: true, default: Date.now, expires: "30d" }
  },
  { versionKey: false }
);

const conversationSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    type: { type: String, enum: ["DIRECT", "ROUTE"], required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    routeId: { type: Schema.Types.ObjectId, ref: "Route" },
    lastMessageAt: Date
  },
  options
);

const messageSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["TEXT", "IMAGE", "LOCATION", "SYSTEM"], default: "TEXT" },
    text: String,
    attachments: [attachmentSchema],
    location: pointFields,
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }]
  },
  options
);

const notificationSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: String,
    entityType: String,
    entityId: Schema.Types.ObjectId,
    readAt: Date
  },
  options
);

// Mongoose's dynamic model registry loses the concrete schema generic during
// hot reload. The explicit `any` keeps watch mode and production builds aligned;
// validation remains enforced by the schemas above and Zod at the API boundary.
export const User: any = models.User || model("User", userSchema);
export const Customer: any = models.Customer || model("Customer", customerSchema);
export const CustomerAddress: any = models.CustomerAddress || model("CustomerAddress", addressSchema);
export const Product: any = models.Product || model("Product", productSchema);
export const Zone: any = models.Zone || model("Zone", zoneSchema);
export const Route: any = models.Route || model("Route", routeSchema);
export const RouteStop: any = models.RouteStop || model("RouteStop", stopSchema);
export const Delivery: any = models.Delivery || model("Delivery", deliverySchema);
export const AddressRequest: any = models.AddressRequest || model("AddressRequest", addressRequestSchema);
export const DriverLocation: any = models.DriverLocation || model("DriverLocation", driverLocationSchema);
export const Conversation: any = models.Conversation || model("Conversation", conversationSchema);
export const Message: any = models.Message || model("Message", messageSchema);
export const Notification: any = models.Notification || model("Notification", notificationSchema);
