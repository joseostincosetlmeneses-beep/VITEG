import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().optional(),
  MONGODB_USERNAME: z.string().optional(),
  MONGODB_PASSWORD: z.string().optional(),
  MONGODB_HOST: z.string().optional(),
  MONGODB_DATABASE: z.string().default("viteg"),
  MONGODB_REPLICA_SET: z.string().optional(),
  JWT_SECRET: z.string().min(32).default("viteg-development-secret-change-me-123456"),
  CLIENT_ORIGIN: z.string().default("http://localhost:8081")
});

const parsed = schema.parse(process.env);
const credentials = parsed.MONGODB_USERNAME && parsed.MONGODB_PASSWORD
  ? `${encodeURIComponent(parsed.MONGODB_USERNAME)}:${encodeURIComponent(parsed.MONGODB_PASSWORD)}`
  : undefined;
const usesStandardAtlasUri = parsed.MONGODB_HOST?.includes(",");
const atlasUri = credentials && parsed.MONGODB_HOST
  ? usesStandardAtlasUri
    ? `mongodb://${credentials}@${parsed.MONGODB_HOST}/${encodeURIComponent(parsed.MONGODB_DATABASE)}?tls=true&replicaSet=${encodeURIComponent(parsed.MONGODB_REPLICA_SET ?? "")}&authSource=admin&retryWrites=true&w=majority&appName=VITEG`
    : `mongodb+srv://${credentials}@${parsed.MONGODB_HOST}/${encodeURIComponent(parsed.MONGODB_DATABASE)}?retryWrites=true&w=majority&appName=VITEG`
  : undefined;

export const env = {
  ...parsed,
  MONGODB_URI: parsed.MONGODB_URI ?? atlasUri ?? "mongodb://127.0.0.1:27017/viteg"
};

