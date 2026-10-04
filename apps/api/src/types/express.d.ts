import type { SessionUser } from "@viteg/shared";

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export {};

