import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./env.js";
import { connectMongo } from "./db.js";
import { verifyAccessToken } from "./jwt.js";

export type HonoEnv = {
  Variables: {
    env: AppEnv;
    /** Set by `requireAuth` for protected routes */
    userId?: string;
  };
};

export const requireDb = createMiddleware<HonoEnv>(async (c, next) => {
  const env = c.get("env");
  await connectMongo(env.MONGODB_URI);
  await next();
});

export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
  const env = c.get("env");
  const header = c.req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m?.[1]) {
    return c.json({ error: "unauthorized", message: "Missing or invalid Authorization header." }, 401);
  }
  try {
    const { userId } = verifyAccessToken(env, m[1]);
    c.set("userId", userId);
    await next();
  } catch {
    return c.json({ error: "unauthorized", message: "Invalid or expired token." }, 401);
  }
});
