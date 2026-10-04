import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AppError, asyncHandler } from "../lib/http.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { User } from "../models/index.js";

const createUserSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "DRIVER"]),
  employeeNumber: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiresAt: z.coerce.date().optional()
});

export const usersRouter = Router();
usersRouter.use(requireAuth, allowRoles("ADMIN"));

usersRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const role = request.query.role;
    const query = { tenantId: "default", ...(role ? { role } : {}) };
    const users = await User.find(query).sort({ firstName: 1, lastName: 1 });
    response.json({ data: users });
  })
);

usersRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = createUserSchema.parse(request.body);
    const user = await User.create({
      ...input,
      email: input.email.toLowerCase(),
      passwordHash: await bcrypt.hash(input.password, 12),
      password: undefined,
      tenantId: "default",
      status: "ACTIVE"
    });
    response.status(201).json({ data: user, message: "Usuario creado" });
  })
);

usersRouter.patch(
  "/:id/status",
  asyncHandler(async (request, response) => {
    const { status } = z.object({ status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "INACTIVE"]) }).parse(request.body);
    const user = await User.findOneAndUpdate(
      { _id: request.params.id, tenantId: "default" },
      { status },
      { new: true, runValidators: true }
    );
    if (!user) throw new AppError(404, "Usuario no encontrado");
    response.json({ data: user });
  })
);

