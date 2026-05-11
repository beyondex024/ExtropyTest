import { Hono } from "hono";
import mongoose from "mongoose";
import { categoryCreateSchema, categoryUpdateSchema, sanitizePlainText } from "@extropy/shared";
import { CategoryModel } from "../models/category.js";
import { ExpenseModel } from "../models/expense.js";
import { logger } from "../logger.js";
import type { HonoEnv } from "../middleware.js";

export const categoryRoutes = new Hono<HonoEnv>();

type LeanCategoryRow = { _id: mongoose.Types.ObjectId; name: string; isDefault: boolean };

categoryRoutes.get("/categories", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const items = (await CategoryModel.find({ userId }).sort({ isDefault: -1, name: 1 }).lean()) as LeanCategoryRow[];
  return c.json({
    categories: items.map((x: LeanCategoryRow) => ({
      id: String(x._id),
      name: x.name,
      isDefault: x.isDefault
    }))
  });
});

categoryRoutes.post("/categories", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const body = await c.req.json().catch(() => null);
  const parsed = categoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "Invalid category.", issues: parsed.error.flatten() },
      400
    );
  }
  const name = sanitizePlainText(parsed.data.name, 64);
  if (!name) {
    return c.json({ error: "validation_error", message: "Category name is empty after sanitization." }, 400);
  }
  try {
    const doc = await CategoryModel.create({ userId, name, isDefault: false });
    logger.info("category_created", { userId, categoryId: String(doc._id) });
    return c.json({ category: { id: String(doc._id), name: doc.name, isDefault: false } }, 201);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: number }).code === 11000) {
      return c.json({ error: "conflict", message: "You already have a category with this name." }, 409);
    }
    throw e;
  }
});

categoryRoutes.patch("/categories/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const id = c.req.param("id");
  if (!mongoose.isValidObjectId(id)) {
    return c.json({ error: "not_found", message: "Category not found." }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = categoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "Invalid update.", issues: parsed.error.flatten() },
      400
    );
  }
  const name = sanitizePlainText(parsed.data.name, 64);
  if (!name) {
    return c.json({ error: "validation_error", message: "Category name is empty after sanitization." }, 400);
  }
  const doc = await CategoryModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: { name } },
    { new: true }
  ).lean();
  if (!doc) return c.json({ error: "not_found", message: "Category not found." }, 404);
  return c.json({ category: { id: String(doc._id), name: doc.name, isDefault: doc.isDefault } });
});

categoryRoutes.delete("/categories/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const id = c.req.param("id");
  if (!mongoose.isValidObjectId(id)) {
    return c.json({ error: "not_found", message: "Category not found." }, 404);
  }
  const existing = await CategoryModel.findOne({ _id: id, userId }).lean();
  if (!existing) return c.json({ error: "not_found", message: "Category not found." }, 404);
  if (existing.isDefault) {
    return c.json({ error: "forbidden", message: "Default categories cannot be deleted." }, 403);
  }
  const inUse = await ExpenseModel.exists({ userId, categoryId: id });
  if (inUse) {
    return c.json(
      {
        error: "conflict",
        message: "This category is used by one or more expenses. Reassign or delete those expenses first."
      },
      409
    );
  }
  await CategoryModel.deleteOne({ _id: id, userId });
  logger.info("category_deleted", { userId, categoryId: id });
  return c.json({ ok: true });
});
