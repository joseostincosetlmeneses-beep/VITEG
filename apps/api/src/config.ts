import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/viteg"),
  JWT_SECRET: z.string().min(32).default("viteg-development-secret-change-me-123456"),
  CLIENT_ORIGIN: z.string().default("http://localhost:8081")
});

export const env = schema.parse(process.env);

