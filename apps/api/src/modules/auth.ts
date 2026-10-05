import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { SessionUser } from "@viteg/shared";
import { env } from "../config.js";
import { AppError, asyncHandler } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/index.js";

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "DRIVER"])
});

const registerSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(100),
  email: z.email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(8).max(72)
});

function toSessionUser(user: any): SessionUser {
  return {
    id: String(user._id),
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    status: user.status
  };
}

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (request, response) => {
    const input = registerSchema.parse(request.body);
    const existing = await User.exists({ tenantId: "default", email: input.email });
    if (existing) throw new AppError(409, "Ya existe una cuenta con este correo");

    await User.create({
      tenantId: "default",
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: "DRIVER",
      status: "PENDING"
    });

    response.status(201).json({
      data: { email: input.email, status: "PENDING" },
      message: "Registro enviado. Un administrador debe activar tu cuenta."
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    const input = loginSchema.parse(request.body);
    const user = await User.findOne({ tenantId: "default", email: input.email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, "Correo o contraseña incorrectos");
    }
    if (user.role !== input.role) {
      throw new AppError(403, "El perfil seleccionado no corresponde a esta cuenta");
    }
    if (user.status !== "ACTIVE") throw new AppError(403, "La cuenta no está activa");

    user.lastAccessAt = new Date();
    await user.save();
    const sessionUser = toSessionUser(user);
    const token = jwt.sign(sessionUser, env.JWT_SECRET, { expiresIn: "12h" });
    response.json({ data: { token, user: sessionUser } });
  })
);

authRouter.get("/me", requireAuth, (request, response) => {
  response.json({ data: request.user });
});

