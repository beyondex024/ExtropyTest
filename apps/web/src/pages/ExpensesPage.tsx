import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseCreateSchema } from "@extropy/shared";
import { z } from "zod";
import {
  useCategories,
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useSuggestCategory,
  useUpdateExpense
} from "../api/queries.js";
import type { Expense } from "../api/types.js";

const modalSchema = expenseCreateSchema;
type ModalForm = z.infer<typeof modalSchema>;

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeValue(v: string) {
  return new Date(v).toISOString();
}

export function ExpensesPage() {
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [to, setTo] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  const expensesQuery = useExpenses({ from, to, categoryId });
  const categoriesQuery = useCategories();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const suggestCategory = useSuggestCategory();

  const [modal, setModal] = useState<null | { mode: "create" } | { mode: "edit"; expense: Expense }>(null);
  const [aiHint, setAiHint] = useState<string | null>(null);

  const categories = categoriesQuery.data?.categories ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="mt-1 text-sm text-slate-600">Add, edit, and filter your spending.</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={() => {
            setAiHint(null);
            setModal({ mode: "create" });
          }}
        >
          Add expense
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-slate-700">From</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={from ? toLocalDatetimeValue(from) : ""}
              onChange={(e) => setFrom(e.target.value ? fromLocalDatetimeValue(e.target.value) : undefined)}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-slate-700">To</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={to ? toLocalDatetimeValue(to) : ""}
              onChange={(e) => setTo(e.target.value ? fromLocalDatetimeValue(e.target.value) : undefined)}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-slate-700">Category</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || undefined)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end md:col-span-1">
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              onClick={() => {
                setFrom(undefined);
                setTo(undefined);
                setCategoryId(undefined);
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {expensesQuery.isLoading ? (
          <div className="p-6 text-sm text-slate-600">Loading expenses…</div>
        ) : expensesQuery.isError ? (
          <div className="p-6 text-sm text-rose-700">{(expensesQuery.error as Error).message}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Category</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(expensesQuery.data?.expenses ?? []).map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{new Date(e.date).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-900">{e.description}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{e.category.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                      {e.amount.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-2 rounded-md px-2 py-1 text-sm font-medium text-slate-900 hover:bg-slate-100"
                        onClick={() => {
                          setAiHint(null);
                          setModal({ mode: "edit", expense: e });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-sm font-medium text-rose-700 hover:bg-rose-50"
                        onClick={async () => {
                          if (!confirm("Delete this expense?")) return;
                          try {
                            await deleteExpense.mutateAsync(e.id);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Delete failed.");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {(expensesQuery.data?.expenses ?? []).length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={5}>
                      No expenses match your filters yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.mode === "create" ? (
        <ExpenseModal
          key="create"
          title="Add expense"
          categories={categories}
          defaultValues={{
            amount: 0.01,
            description: "",
            categoryId: categories[0]?.id ?? "",
            date: new Date().toISOString()
          }}
          aiHint={aiHint}
          setAiHint={setAiHint}
          suggestCategory={suggestCategory}
          isSaving={createExpense.isPending}
          onClose={() => setModal(null)}
          onSave={async (values) => {
            await createExpense.mutateAsync(values);
            setModal(null);
          }}
        />
      ) : null}

      {modal?.mode === "edit" ? (
        <ExpenseModal
          key={modal.expense.id}
          title="Edit expense"
          categories={categories}
          defaultValues={{
            amount: modal.expense.amount,
            description: modal.expense.description,
            categoryId: modal.expense.category.id,
            date: modal.expense.date
          }}
          aiHint={aiHint}
          setAiHint={setAiHint}
          suggestCategory={suggestCategory}
          isSaving={updateExpense.isPending}
          onClose={() => setModal(null)}
          onSave={async (values) => {
            await updateExpense.mutateAsync({
              id: modal.expense.id,
              patch: values
            });
            setModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ExpenseModal(props: {
  title: string;
  categories: { id: string; name: string }[];
  defaultValues: ModalForm;
  aiHint: string | null;
  setAiHint: (v: string | null) => void;
  suggestCategory: ReturnType<typeof useSuggestCategory>;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: ModalForm) => Promise<void>;
}) {
  const form = useForm<ModalForm>({
    resolver: zodResolver(modalSchema),
    defaultValues: props.defaultValues
  });

  const watchedDescription = form.watch("description");
  const watchedAmount = form.watch("amount");
  const watchedDate = form.watch("date");

  const amountForAi = useMemo(() => {
    const n = Number(watchedAmount);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [watchedAmount]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <button type="button" className="text-sm text-slate-600 hover:text-slate-900" onClick={props.onClose}>
            Close
          </button>
        </div>

        <form
          className="mt-4 space-y-4"
          onSubmit={form.handleSubmit(async (vals) => {
            try {
              await props.onSave(vals);
            } catch (e) {
              alert(e instanceof Error ? e.message : "Save failed.");
            }
          })}
          noValidate
        >
          <input type="hidden" {...form.register("date")} />

          <div>
            <label className="text-sm font-medium">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...form.register("amount", { valueAsNumber: true })}
            />
            {form.formState.errors.amount?.message ? (
              <p className="mt-1 text-sm text-rose-700">{String(form.formState.errors.amount.message)}</p>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">Description</label>
              <button
                type="button"
                className="text-sm font-semibold text-slate-900 underline disabled:opacity-50"
                disabled={props.suggestCategory.isPending || !String(watchedDescription || "").trim()}
                onClick={async () => {
                  props.setAiHint(null);
                  try {
                    const res = await props.suggestCategory.mutateAsync({
                      description: String(watchedDescription || ""),
                      amount: amountForAi,
                      date: typeof watchedDate === "string" ? watchedDate : undefined
                    });
                    if (!res.available) {
                      props.setAiHint(res.message);
                      return;
                    }
                    form.setValue("categoryId", res.suggestion.categoryId, { shouldValidate: true, shouldDirty: true });
                    props.setAiHint(
                      `Suggested: ${res.suggestion.name} (${Math.round(res.suggestion.confidence * 100)}% confidence).`
                    );
                  } catch (e) {
                    props.setAiHint(e instanceof Error ? e.message : "AI suggestion failed.");
                  }
                }}
              >
                {props.suggestCategory.isPending ? "Suggesting…" : "Suggest category (AI)"}
              </button>
            </div>
            <textarea
              className="mt-1 min-h-[90px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...form.register("description")}
            />
            {form.formState.errors.description?.message ? (
              <p className="mt-1 text-sm text-rose-700">{String(form.formState.errors.description.message)}</p>
            ) : null}
            {props.aiHint ? <p className="mt-2 text-sm text-slate-700">{props.aiHint}</p> : null}
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("categoryId")}>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {form.formState.errors.categoryId?.message ? (
              <p className="mt-1 text-sm text-rose-700">{String(form.formState.errors.categoryId.message)}</p>
            ) : null}
          </div>

          <div>
            <label className="text-sm font-medium">Date</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={toLocalDatetimeValue(String(form.watch("date") || new Date().toISOString()))}
              onChange={(e) => form.setValue("date", fromLocalDatetimeValue(e.target.value), { shouldValidate: true })}
            />
            {form.formState.errors.date?.message ? (
              <p className="mt-1 text-sm text-rose-700">{String(form.formState.errors.date.message)}</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={props.onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={props.isSaving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {props.isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
