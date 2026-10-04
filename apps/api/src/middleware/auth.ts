import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role, SessionUser } from "@viteg/shared";
import { env } from "../config.js";
import { AppError } from "../lib/http.js";

export function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next(new AppError(401, "Sesión requerida"));
  try {
    request.user = jwt.verify(token, env.JWT_SECRET) as SessionUser;
    next();
  } catch {
    next(new AppError(401, "Sesión inválida o vencida"));
  }
}

export function allowRoles(...roles: Role[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.user || !roles.includes(request.user.role)) {
      return next(new AppError(403, "No tienes permiso para realizar esta acción"));
    }
    next();
  };
}

