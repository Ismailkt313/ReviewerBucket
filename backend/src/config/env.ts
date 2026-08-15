import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535),
  MONGODB_URI: z.string().min(1),
  CLIENT_URL: z.string().url(),
  COMMUNITY_HISTORY_LIMIT: z.coerce.number().int().min(1).max(200).default(50),
  COMMUNITY_MESSAGE_MAX_LENGTH: z.coerce.number().int().min(10).max(2000).default(500),
  COMMUNITY_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(10000),
  COMMUNITY_RATE_LIMIT_MAX_MESSAGES: z.coerce.number().int().min(1).max(50).default(5),
  JWT_SECRET: z.string().min(1).default("reviewer-bucket-admin-jwt-secret-key-2026")
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");
  console.error(JSON.stringify(result.error.format(), null, 2));
  process.exit(1);
}

export const env = result.data;
