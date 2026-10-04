import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function asyncHandler(
  fn: (request: Request, response: Response, next: NextFunction) => Promise<unknown>
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void fn(request, response, next).catch(next);
  };
}

export const notFound = (request: Request, _response: Response, next: NextFunction) => {
  next(new AppError(404, `No existe ${request.method} ${request.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ message: "Datos inválidos", errors: error.issues });
    return;
  }
  if (error instanceof AppError) {
    response.status(error.status).json({ message: error.message, details: error.details });
    return;
  }
  if (error?.name === "ValidationError") {
    response.status(400).json({ message: "Datos inválidos", details: error.errors });
    return;
  }
  if (error?.code === 11000) {
    response.status(409).json({ message: "El registro ya existe", details: error.keyValue });
    return;
  }
  console.error(error);
  response.status(500).json({ message: "Error interno del servidor" });
};

