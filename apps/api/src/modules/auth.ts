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
  password: z.string().min(8)
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
  "/login",
  asyncHandler(async (request, response) => {
    const input = loginSchema.parse(request.body);
    const user = await User.findOne({ tenantId: "default", email: input.email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, "Correo o contraseña incorrectos");
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

