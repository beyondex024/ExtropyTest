import { Hono } from "hono";
import mongoose from "mongoose";
import { suggestCategorySchema, sanitizePlainText } from "@extropy/shared";
import { CategoryModel } from "../models/category.js";
import { logger } from "../logger.js";
import type { HonoEnv } from "../middleware.js";

type SuggestOk = {
  available: true;
  suggestion: { categoryId: string; name: string; confidence: number; rationale?: string };
};

type SuggestNo = {
  available: false;
  reason: "AI_DISABLED" | "AI_ERROR" | "AI_UNCERTAIN";
  message: string;
};

export const aiRoutes = new Hono<HonoEnv>();

type LeanCategoryRow = { _id: mongoose.Types.ObjectId; name: string; isDefault: boolean };

aiRoutes.post("/ai/suggest-category", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized", message: "Missing session." }, 401);
  const env = c.get("env");
  const body = await c.req.json().catch(() => null);
  const parsed = suggestCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", message: "Invalid request.", issues: parsed.error.flatten() },
      400
    );
  }
  const description = sanitizePlainText(parsed.data.description, 500);
  if (!description) {
    return c.json({ error: "validation_error", message: "Description is empty after sanitization." }, 400);
  }

  const categories = (await CategoryModel.find({ userId }).sort({ name: 1 }).lean()) as LeanCategoryRow[];
  const catPayload = categories.map((x: LeanCategoryRow) => ({ id: String(x._id), name: x.name }));

  if (!env.OPENAI_API_KEY) {
    const payload: SuggestNo = {
      available: false,
      reason: "AI_DISABLED",
      message:
        "AI suggestions are disabled because OPENAI_API_KEY is not configured. Add a key to enable this feature."
    };
    return c.json(payload);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const system = [
      "You help users categorize personal expenses.",
      "Pick exactly ONE category from the provided list by using its `id` field.",
      "Return STRICT JSON with keys: categoryId (string), confidence (number 0..1), rationale (string, <=200 chars).",
      "If you cannot confidently map to a category, set confidence below 0.35 and still pick your best guess."
    ].join(" ");

    const userMsg = JSON.stringify({
      categories: catPayload,
      expense: {
        description,
        amount: parsed.data.amount,
        date: parsed.data.date
      }
    });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg }
        ]
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn("openai_http_error", { status: res.status, body: text.slice(0, 500) });
      const payload: SuggestNo = {
        available: false,
        reason: "AI_ERROR",
        message: "The AI provider returned an error. Please pick a category manually."
      };
      return c.json(payload);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      const payload: SuggestNo = {
        available: false,
        reason: "AI_ERROR",
        message: "Unexpected AI response. Please pick a category manually."
      };
      return c.json(payload);
    }

    let parsedOut: { categoryId?: string; confidence?: number; rationale?: string };
    try {
      parsedOut = JSON.parse(content) as typeof parsedOut;
    } catch {
      const payload: SuggestNo = {
        available: false,
        reason: "AI_ERROR",
        message: "Could not parse AI output. Please pick a category manually."
      };
      return c.json(payload);
    }

    const categoryId = parsedOut.categoryId;
    const confidence = typeof parsedOut.confidence === "number" ? parsedOut.confidence : 0;
    if (!categoryId || !catPayload.some((x: { id: string; name: string }) => x.id === categoryId)) {
      const payload: SuggestNo = {
        available: false,
        reason: "AI_UNCERTAIN",
        message: "The model did not return a valid category for your account. Please choose manually."
      };
      return c.json(payload);
    }

    if (confidence < 0.35) {
      const payload: SuggestNo = {
        available: false,
        reason: "AI_UNCERTAIN",
        message: "The model is not confident enough to suggest a category. Please choose manually."
      };
      return c.json(payload);
    }

    const chosen = catPayload.find((x: { id: string; name: string }) => x.id === categoryId)!;
    const payload: SuggestOk = {
      available: true,
      suggestion: {
        categoryId: chosen.id,
        name: chosen.name,
        confidence,
        rationale: typeof parsedOut.rationale === "string" ? parsedOut.rationale.slice(0, 200) : undefined
      }
    };
    logger.info("ai_suggest_category_ok", { userId, categoryId: chosen.id, confidence });
    return c.json(payload);
  } catch (e) {
    logger.error("ai_suggest_category_failed", { err: String(e) });
    const payload: SuggestNo = {
      available: false,
      reason: "AI_ERROR",
      message: "AI suggestion failed (timeout or network). Please pick a category manually."
    };
    return c.json(payload);
  } finally {
    clearTimeout(timeout);
  }
});
