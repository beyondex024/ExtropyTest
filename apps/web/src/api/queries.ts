import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./http.js";
import type { Category, Expense } from "./types.js";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<{ categories: Category[] }>("/categories")
  });
}

export function useExpenses(params: { from?: string; to?: string; categoryId?: string }) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return useQuery({
    queryKey: ["expenses", params],
    queryFn: () => apiFetch<{ expenses: Expense[] }>(`/expenses${suffix}`)
  });
}

export function useMonthlyReport(year: number, month: number) {
  return useQuery({
    queryKey: ["reports", "monthly", year, month],
    queryFn: () =>
      apiFetch<{
        year: number;
        month: number;
        total: number;
        currency: string;
        range: { from: string; to: string };
      }>(`/reports/monthly?year=${year}&month=${month}`)
  });
}

export function useByCategoryReport(from: string, to: string) {
  return useQuery({
    queryKey: ["reports", "by-category", from, to],
    queryFn: () =>
      apiFetch<{ breakdown: { categoryId: string; name: string; isDefault: boolean; total: number }[] }>(
        `/reports/by-category?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      ),
    enabled: Boolean(from && to)
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ category: Category }>("/categories", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
    }
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
    }
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; name: string }) =>
      apiFetch<{ category: Category }>(`/categories/${args.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: args.name })
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["categories"] });
    }
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { amount: number; description: string; categoryId: string; date: string }) =>
      apiFetch<{ expense: Expense }>("/expenses", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; patch: Partial<{ amount: number; description: string; categoryId: string; date: string }> }) =>
      apiFetch<{ expense: Expense }>(`/expenses/${args.id}`, { method: "PATCH", body: JSON.stringify(args.patch) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export type SuggestCategoryResponse =
  | {
      available: true;
      suggestion: { categoryId: string; name: string; confidence: number; rationale?: string };
    }
  | { available: false; reason: string; message: string };

export function useSuggestCategory() {
  return useMutation({
    mutationFn: (payload: { description: string; amount?: number; date?: string }) =>
      apiFetch<SuggestCategoryResponse>("/ai/suggest-category", {
        method: "POST",
        body: JSON.stringify(payload)
      })
  });
}
