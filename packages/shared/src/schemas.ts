import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128)
});

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(64)
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1).max(64)
});

const isoDateString = z
  .string()
  .min(1)
  .refine((s: string) => !Number.isNaN(Date.parse(s)), { message: "Invalid ISO date string." });

export const expenseCreateSchema = z.object({
  amount: z.number().finite().positive().max(1_000_000_000),
  description: z.string().min(1).max(500),
  categoryId: z.string().min(1).max(64),
  date: isoDateString
});

export const expenseUpdateSchema = z.object({
  amount: z.number().finite().positive().max(1_000_000_000).optional(),
  description: z.string().min(1).max(500).optional(),
  categoryId: z.string().min(1).max(64).optional(),
  date: isoDateString.optional()
});

export const expenseListQuerySchema = z.object({
  from: isoDateString.optional(),
  to: isoDateString.optional(),
  categoryId: z.string().optional()
});

export const monthlyReportQuerySchema = z.object({
  year: z.coerce.number().int().min(1970).max(2100),
  month: z.coerce.number().int().min(1).max(12)
});

export const byCategoryReportQuerySchema = z.object({
  from: isoDateString,
  to: isoDateString
});

export const suggestCategorySchema = z.object({
  description: z.string().min(1).max(500),
  amount: z.number().finite().positive().max(1_000_000_000).optional(),
  date: isoDateString.optional()
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
