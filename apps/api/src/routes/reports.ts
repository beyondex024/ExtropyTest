import { Hono } from "hono";
import mongoose from "mongoose";
import { monthlyReportQuerySchema, byCategoryReportQuerySchema } from "@extropy/shared";
import { ExpenseModel } from "../models/expense.js";
import type { HonoEnv } from "../middleware.js";

export const reportRoutes = new Hono<HonoEnv>();

reportRoutes.get("/reports/monthly", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const parsed = monthlyReportQuerySchema.safeParse({
    year: c.req.query("year"),
    month: c.req.query("month")
  });
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "Invalid query parameters.", issues: parsed.error.flatten() },
      400
    );
  }
  const { year, month } = parsed.data;
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const uid = new mongoose.Types.ObjectId(userId);
  const agg = await ExpenseModel.aggregate<{ _id: null; total: number }>([
    { $match: { userId: uid, date: { $gte: start, $lte: end } } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  const total = agg[0]?.total ?? 0;
  return c.json({
    year,
    month,
    total,
    currency: "USD",
    range: { from: start.toISOString(), to: end.toISOString() }
  });
});

reportRoutes.get("/reports/by-category", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const parsed = byCategoryReportQuerySchema.safeParse({
    from: c.req.query("from"),
    to: c.req.query("to")
  });
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "Invalid query parameters.", issues: parsed.error.flatten() },
      400
    );
  }
  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (from > to) {
    return c.json({ error: "validation_error", message: "`from` must be before `to`." }, 400);
  }
  const uid = new mongoose.Types.ObjectId(userId);
  const rows = await ExpenseModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    total: number;
    name: string;
    isDefault: boolean;
  }>([
    { $match: { userId: uid, date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: "$categoryId",
        total: { $sum: "$amount" }
      }
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "cat"
      }
    },
    { $unwind: "$cat" },
    {
      $project: {
        _id: 1,
        total: 1,
        name: "$cat.name",
        isDefault: "$cat.isDefault"
      }
    },
    { $sort: { total: -1 } }
  ]);
  return c.json({
    from: from.toISOString(),
    to: to.toISOString(),
    breakdown: rows.map((r) => ({
      categoryId: String(r._id),
      name: r.name,
      isDefault: r.isDefault,
      total: r.total
    }))
  });
});
