import { Hono } from "hono";
import { registerSchema, loginSchema, DEFAULT_CATEGORY_NAMES } from "@extropy/shared";
import { UserModel } from "../models/user.js";
import { CategoryModel } from "../models/category.js";
import { hashPassword, verifyPassword } from "../password.js";
import { signAccessToken } from "../jwt.js";
import { logger } from "../logger.js";
import type { HonoEnv } from "../middleware.js";

export const authRoutes = new Hono<HonoEnv>();

authRoutes.post("/auth/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "Invalid registration payload.", issues: parsed.error.flatten() },
      400
    );
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await UserModel.findOne({ email }).lean();
  if (existing) {
    return c.json({ error: "conflict", message: "An account with this email already exists." }, 409);
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await UserModel.create({ email, passwordHash });
  for (const name of DEFAULT_CATEGORY_NAMES) {
    await CategoryModel.create({ userId: user._id, name, isDefault: true });
  }
  const env = c.get("env");
  const token = signAccessToken(env, String(user._id));
  logger.info("user_registered", { userId: String(user._id) });
  return c.json({
    token,
    user: { id: String(user._id), email: user.email }
  });
});

authRoutes.post("/auth/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "Invalid login payload.", issues: parsed.error.flatten() },
      400
    );
  }
  const email = parsed.data.email.toLowerCase().trim();
  const user = await UserModel.findOne({ email });
  if (!user) {
    return c.json({ error: "invalid_credentials", message: "Email or password is incorrect." }, 401);
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return c.json({ error: "invalid_credentials", message: "Email or password is incorrect." }, 401);
  }
  const env = c.get("env");
  const token = signAccessToken(env, String(user._id));
  logger.info("user_login", { userId: String(user._id) });
  return c.json({
    token,
    user: { id: String(user._id), email: user.email }
  });
});
