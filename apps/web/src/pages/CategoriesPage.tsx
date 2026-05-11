import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categoryCreateSchema, categoryUpdateSchema } from "@extropy/shared";
import { z } from "zod";
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "../api/queries.js";
import type { Category } from "../api/types.js";

type CreateFormValues = z.infer<typeof categoryCreateSchema>;
type RenameFormValues = z.infer<typeof categoryUpdateSchema>;

export function CategoriesPage() {
  const categoriesQuery = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const updateCategory = useUpdateCategory();
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: { name: "" }
  });

  const renameForm = useForm<RenameFormValues>({
    resolver: zodResolver(categoryUpdateSchema),
    defaultValues: { name: "" }
  });

  const categories = categoriesQuery.data?.categories ?? [];

  function startRename(c: Category) {
    setRenamingId(c.id);
    renameForm.reset({ name: c.name });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="mt-1 text-sm text-slate-600">
          Defaults are created on signup. Add custom categories, rename any category, or delete custom ones that are unused.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Add a category</h2>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await createCategory.mutateAsync(values.name);
              form.reset({ name: "" });
            } catch (e) {
              alert(e instanceof Error ? e.message : "Could not create category.");
            }
          })}
          noValidate
        >
          <div className="flex-1">
            <label className="text-sm font-medium" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...form.register("name")}
            />
            {form.formState.errors.name?.message ? (
              <p className="mt-1 text-sm text-rose-700">{String(form.formState.errors.name.message)}</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={createCategory.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {createCategory.isPending ? "Adding…" : "Add category"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {categoriesQuery.isLoading ? (
          <div className="p-6 text-sm text-slate-600">Loading categories…</div>
        ) : categoriesQuery.isError ? (
          <div className="p-6 text-sm text-rose-700">{(categoriesQuery.error as Error).message}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {renamingId === c.id ? (
                        <form
                          className="flex flex-wrap items-center gap-2"
                          onSubmit={renameForm.handleSubmit(async (values) => {
                            try {
                              await updateCategory.mutateAsync({ id: c.id, name: values.name });
                              setRenamingId(null);
                            } catch (e) {
                              alert(e instanceof Error ? e.message : "Rename failed.");
                            }
                          })}
                        >
                          <input
                            className="min-w-[12rem] rounded-md border border-slate-300 px-2 py-1 text-sm"
                            {...renameForm.register("name")}
                          />
                          {renameForm.formState.errors.name?.message ? (
                            <span className="text-xs text-rose-700">{String(renameForm.formState.errors.name.message)}</span>
                          ) : null}
                          <button
                            type="submit"
                            disabled={updateCategory.isPending}
                            className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium"
                            onClick={() => setRenamingId(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.isDefault ? "Default" : "Custom"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {renamingId === c.id ? null : (
                        <>
                          <button
                            type="button"
                            className="mr-2 rounded-md px-2 py-1 text-sm font-medium text-slate-900 hover:bg-slate-100"
                            onClick={() => startRename(c)}
                          >
                            Rename
                          </button>
                          {c.isDefault ? (
                            <span className="text-xs text-slate-500">—</span>
                          ) : (
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-sm font-medium text-rose-700 hover:bg-rose-50"
                              onClick={async () => {
                                if (!confirm(`Delete category “${c.name}”?`)) return;
                                try {
                                  await deleteCategory.mutateAsync(c.id);
                                } catch (e) {
                                  alert(e instanceof Error ? e.message : "Delete failed.");
                                }
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
