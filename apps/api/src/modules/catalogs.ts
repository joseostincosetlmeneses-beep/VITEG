import { Router } from "express";
import type { Model } from "mongoose";
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

export const customersRouter = crudRouter(Customer);
export const addressesRouter = crudRouter(CustomerAddress, "customerId zoneId");
export const productsRouter = crudRouter(Product);
export const zonesRouter = crudRouter(Zone);

