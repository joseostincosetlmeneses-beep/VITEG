import { Router } from "express";
import type { Model } from "mongoose";
import { z } from "zod";
import { asyncHandler, AppError } from "../lib/http.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { Customer, CustomerAddress, Product, Zone } from "../models/index.js";

function crudRouter(model: Model<any>, populate?: string) {
  const router = Router();
  router.use(requireAuth);
  router.get(
    "/",
    asyncHandler(async (_request, response) => {
      const query = model.find({ tenantId: "default" }).sort({ createdAt: -1 });
      if (populate) query.populate(populate);
      response.json({ data: await query });
    })
  );
  router.get(
    "/:id",
    asyncHandler(async (request, response) => {
      const query = model.findOne({ _id: request.params.id, tenantId: "default" });
      if (populate) query.populate(populate);
      const document = await query;
      if (!document) throw new AppError(404, "Registro no encontrado");
      response.json({ data: document });
    })
  );
  router.post(
    "/",
    allowRoles("ADMIN"),
    asyncHandler(async (request, response) => {
      const document = await model.create({ ...request.body, tenantId: "default" });
      response.status(201).json({ data: document });
    })
  );
  router.patch(
    "/:id",
    allowRoles("ADMIN"),
    asyncHandler(async (request, response) => {
      const document = await model.findOneAndUpdate(
        { _id: request.params.id, tenantId: "default" },
        { $set: request.body },
        { new: true, runValidators: true }
      );
      if (!document) throw new AppError(404, "Registro no encontrado");
      response.json({ data: document });
    })
  );
  router.delete(
    "/:id",
    allowRoles("ADMIN"),
    asyncHandler(async (request, response) => {
      const document = await model.findOneAndDelete({ _id: request.params.id, tenantId: "default" });
      if (!document) throw new AppError(404, "Registro no encontrado");
      response.status(204).send();
    })
  );
  return router;
}

const customerInputSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  description: z.string().min(2),
  location: z.object({
    label: z.string().min(2),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  })
});

export const customersRouter = Router();
customersRouter.use(requireAuth);
customersRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const customers = await Customer.find({ tenantId: "default" }).sort({ createdAt: -1 }).lean();
    const addresses = await CustomerAddress.find({
      tenantId: "default",
      customerId: { $in: customers.map((customer: any) => customer._id) }
    }).lean();
    const addressByCustomer = new Map(addresses.map((address: any) => [String(address.customerId), address]));
    response.json({
      data: customers.map((customer: any) => ({
        ...customer,
        name: customer.businessName || `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim(),
        address: addressByCustomer.get(String(customer._id)) ?? null
      }))
    });
  })
);
customersRouter.post(
  "/",
  allowRoles("ADMIN"),
  asyncHandler(async (request, response) => {
    const input = customerInputSchema.parse(request.body);
    const customer = await Customer.create({
      tenantId: "default",
      type: "NEGOCIO",
      businessName: input.name,
      phone: input.phone,
      notes: input.description,
      status: "ACTIVE"
    });
    try {
      const address = await CustomerAddress.create({
        tenantId: "default",
        customerId: customer._id,
        alias: input.name,
        street: input.location.label,
        exteriorNumber: "S/N",
        neighborhood: "No especificada",
        city: "Huamantla",
        state: "Tlaxcala",
        reference: input.description,
        deliveryInstructions: input.description,
        location: { latitude: input.location.latitude, longitude: input.location.longitude },
        status: "ACTIVE"
      });
      response.status(201).json({ data: { ...customer.toObject(), name: input.name, address } });
    } catch (error) {
      await customer.deleteOne();
      throw error;
    }
  })
);
customersRouter.patch(
  "/:id",
  allowRoles("ADMIN"),
  asyncHandler(async (request, response) => {
    const input = customerInputSchema.parse(request.body);
    const customer = await Customer.findOneAndUpdate(
      { _id: request.params.id, tenantId: "default" },
      { $set: { businessName: input.name, phone: input.phone, notes: input.description } },
      { new: true, runValidators: true }
    );
    if (!customer) throw new AppError(404, "Cliente no encontrado");
    const address = await CustomerAddress.findOneAndUpdate(
      { customerId: customer._id, tenantId: "default" },
      { $set: {
        alias: input.name,
        street: input.location.label,
        reference: input.description,
        deliveryInstructions: input.description,
        location: { latitude: input.location.latitude, longitude: input.location.longitude }
      } },
      { new: true, runValidators: true }
    );
    if (!address) throw new AppError(404, "Domicilio del cliente no encontrado");
    response.json({ data: { ...customer.toObject(), name: input.name, address } });
  })
);
export const addressesRouter = crudRouter(CustomerAddress, "customerId zoneId");
export const productsRouter = crudRouter(Product);
export const zonesRouter = crudRouter(Zone);

