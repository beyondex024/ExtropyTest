import { z } from "zod";
import { logger } from "./logger.js";

const schema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  OPENAI_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  LOG_LEVEL: z.string().optional()
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | null = null;

export function getEnv():
  | { ok: true; env: AppEnv }
  | { ok: false; error: string; details?: Record<string, string[]> } {
  if (cached) return { ok: true, env: cached };

  const parsed = schema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    LOG_LEVEL: process.env.LOG_LEVEL
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg = "Invalid or missing environment configuration.";
    logger.error("env_validation_failed", { fieldErrors: flat.fieldErrors });
    return { ok: false, error: msg, details: flat.fieldErrors as Record<string, string[]> };
  }

  cached = parsed.data;
  return { ok: true, env: cached };
}

export function resetEnvCacheForTests() {
  cached = null;
}
