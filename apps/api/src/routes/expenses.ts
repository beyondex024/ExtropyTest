import { Hono } from "hono";
import mongoose from "mongoose";
import {
  expenseCreateSchema,
  expenseUpdateSchema,
  expenseListQuerySchema,
  sanitizePlainText
} from "@extropy/shared";
import { ExpenseModel } from "../models/expense.js";
import { CategoryModel } from "../models/category.js";
import { logger } from "../logger.js";
import type { HonoEnv } from "../middleware.js";

const MAX_PAGE = 500;

type PopulatedCategoryLean = { _id: mongoose.Types.ObjectId; name: string; isDefault: boolean };

type ExpenseListRow = {
  _id: mongoose.Types.ObjectId;
  amount: number;
  description: string;
  date: Date;
  categoryId: PopulatedCategoryLean;
  createdAt?: Date;
  updatedAt?: Date;
};

export const expenseRoutes = new Hono<HonoEnv>();

async function assertCategoryOwned(userId: string, categoryId: string) {
  const cat = await CategoryModel.findOne({ _id: categoryId, userId }).lean();
  return cat ? String(cat._id) : null;
}

expenseRoutes.get("/expenses", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const q = expenseListQuerySchema.safeParse({
    from: c.req.query("from") ?? undefined,
    to: c.req.query("to") ?? undefined,
    categoryId: c.req.query("categoryId") ?? undefined
  });
  if (!q.success) {
    return c.json(
      { error: "validation_error", message: "Invalid query parameters.", issues: q.error.flatten() },
      400
    );
  }
  const filter: Record<string, unknown> = { userId };
  if (q.data.from || q.data.to) {
    filter.date = {};
    if (q.data.from) (filter.date as Record<string, Date>).$gte = new Date(q.data.from);
    if (q.data.to) (filter.date as Record<string, Date>).$lte = new Date(q.data.to);
  }
  if (q.data.categoryId) {
    if (!mongoose.isValidObjectId(q.data.categoryId)) {
      return c.json({ error: "validation_error", message: "Invalid categoryId." }, 400);
    }
    const owned = await assertCategoryOwned(userId, q.data.categoryId);
    if (!owned) return c.json({ error: "validation_error", message: "Unknown category." }, 400);
    filter.categoryId = owned;
  }
  const rows = (await ExpenseModel.find(filter)
    .sort({ date: -1 })
    .limit(MAX_PAGE)
    .populate("categoryId", "name isDefault")
    .lean()) as unknown as ExpenseListRow[];
  return c.json({
    expenses: rows.map((e: ExpenseListRow) => ({
      id: String(e._id),
      amount: e.amount,
      description: e.description,
      date: (e.date as Date).toISOString(),
      category: {
        id: String(e.categoryId._id),
        name: e.categoryId.name,
        isDefault: e.categoryId.isDefault
      },
      createdAt: e.createdAt ? (e.createdAt as Date).toISOString() : undefined,
      updatedAt: e.updatedAt ? (e.updatedAt as Date).toISOString() : undefined
    }))
  });
});

expenseRoutes.post("/expenses", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const body = await c.req.json().catch(() => null);
  const parsed = expenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "Invalid expense.", issues: parsed.error.flatten() },
      400
    );
  }
  const categoryId = await assertCategoryOwned(userId, parsed.data.categoryId);
  if (!categoryId) {
    return c.json({ error: "validation_error", message: "Unknown category." }, 400);
  }
  const description = sanitizePlainText(parsed.data.description, 500);
  if (!description) {
    return c.json({ error: "validation_error", message: "Description is empty after sanitization." }, 400);
  }
  const doc = await ExpenseModel.create({
    userId,
    categoryId,
    amount: parsed.data.amount,
    description,
    date: new Date(parsed.data.date)
  });
  logger.info("expense_created", { userId, expenseId: String(doc._id) });
  const populated = (await ExpenseModel.findById(doc._id).populate("categoryId", "name isDefault").lean()) as unknown as
    | ExpenseListRow
    | null;
  if (!populated) return c.json({ error: "server_error", message: "Failed to load created expense." }, 500);
  return c.json(
    {
      expense: {
        id: String(populated._id),
        amount: populated.amount,
        description: populated.description,
        date: (populated.date as Date).toISOString(),
        category: {
          id: String(populated.categoryId._id),
          name: populated.categoryId.name,
          isDefault: populated.categoryId.isDefault
        }
      }
    },
    201
  );
});

expenseRoutes.patch("/expenses/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const id = c.req.param("id");
  if (!mongoose.isValidObjectId(id)) {
    return c.json({ error: "not_found", message: "Expense not found." }, 404);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = expenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "Invalid update.", issues: parsed.error.flatten() },
      400
    );
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.amount !== undefined) update.amount = parsed.data.amount;
  if (parsed.data.date !== undefined) update.date = new Date(parsed.data.date);
  if (parsed.data.description !== undefined) {
    const d = sanitizePlainText(parsed.data.description, 500);
    if (!d) return c.json({ error: "validation_error", message: "Description is empty after sanitization." }, 400);
    update.description = d;
  }
  if (parsed.data.categoryId !== undefined) {
    const cid = await assertCategoryOwned(userId, parsed.data.categoryId);
    if (!cid) return c.json({ error: "validation_error", message: "Unknown category." }, 400);
    update.categoryId = cid;
  }
  const doc = (await ExpenseModel.findOneAndUpdate({ _id: id, userId }, { $set: update }, { new: true })
    .populate("categoryId", "name isDefault")
    .lean()) as unknown as ExpenseListRow | null;
  if (!doc) return c.json({ error: "not_found", message: "Expense not found." }, 404);
  return c.json({
    expense: {
      id: String(doc._id),
      amount: doc.amount,
      description: doc.description,
      date: (doc.date as Date).toISOString(),
      category: {
        id: String(doc.categoryId._id),
        name: doc.categoryId.name,
        isDefault: doc.categoryId.isDefault
      }
    }
  });
});

expenseRoutes.delete("/expenses/:id", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const id = c.req.param("id");
  if (!mongoose.isValidObjectId(id)) {
    return c.json({ error: "not_found", message: "Expense not found." }, 404);
  }
  const res = await ExpenseModel.deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) return c.json({ error: "not_found", message: "Expense not found." }, 404);
  logger.info("expense_deleted", { userId, expenseId: id });
  return c.json({ ok: true });
});
