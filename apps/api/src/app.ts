import { Hono } from "hono";
import { cors } from "hono/cors";
import mongoose from "mongoose";
import { getEnv } from "./env.js";
import { connectMongo } from "./db.js";
import { requireAuth, requireDb, type HonoEnv } from "./middleware.js";
import { authRoutes } from "./routes/auth.js";
import { categoryRoutes } from "./routes/categories.js";
import { expenseRoutes } from "./routes/expenses.js";
import { reportRoutes } from "./routes/reports.js";
import { aiRoutes } from "./routes/ai.js";
import { logger } from "./logger.js";
import { createMiddleware } from "hono/factory";

const envMw = createMiddleware<HonoEnv>(async (c, next) => {
  const e = getEnv();
  if (!e.ok) {
    return c.json(
      {
        error: "configuration_error",
        message: e.error,
        details: e.details ?? null
      },
      503
    );
  }
  c.set("env", e.env);
  await next();
});

export const app = new Hono();

app.onError((err, c) => {
  logger.error("unhandled_error", { err: String(err), path: c.req.path });
  return c.json({ error: "server_error", message: "Something went wrong. Please try again." }, 500);
});

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
  })
);

app.get("/health", async (c) => {
  const e = getEnv();
  if (!e.ok) {
    return c.json(
      {
        ok: false,
        error: "configuration_error",
        message: e.error,
        details: e.details ?? null
      },
      503
    );
  }
  try {
    await connectMongo(e.env.MONGODB_URI);
    await mongoose.connection.db?.command({ ping: 1 });
    return c.json({ ok: true });
  } catch (err) {
    logger.error("health_db_failed", { err: String(err) });
    return c.json({ ok: false, database: "unreachable", message: "Cannot reach MongoDB." }, 503);
  }
});

const publicApi = new Hono<HonoEnv>();
publicApi.use("*", envMw);
publicApi.use("*", requireDb);
publicApi.route("/", authRoutes);

const privateApi = new Hono<HonoEnv>();
privateApi.use("*", envMw);
privateApi.use("*", requireDb);
privateApi.use("*", requireAuth);
privateApi.route("/", categoryRoutes);
privateApi.route("/", expenseRoutes);
privateApi.route("/", reportRoutes);
privateApi.route("/", aiRoutes);

app.route("/", publicApi);
app.route("/", privateApi);
