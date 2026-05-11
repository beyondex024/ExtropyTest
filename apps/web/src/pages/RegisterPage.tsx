import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { registerSchema } from "@extropy/shared";
import { z } from "zod";
import { useState } from "react";
import { apiFetch } from "../api/http.js";
import { useAuthStore } from "../store/auth.js";

const formSchema = registerSchema;
type FormValues = z.infer<typeof formSchema>;

export function RegisterPage() {
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" }
  });

  if (token) return <Navigate to="/expenses" replace />;

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const res = await apiFetch<{ token: string; user: { id: string; email: string } }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(values),
        auth: false
      });
      setSession(res.token, res.user);
      navigate("/expenses", { replace: true });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Registration failed.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">Password must be at least 8 characters.</p>

        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              {...form.register("email")}
            />
            {form.formState.errors.email?.message ? (
              <p className="mt-1 text-sm text-rose-700">{String(form.formState.errors.email.message)}</p>
            ) : null}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              {...form.register("password")}
            />
            {form.formState.errors.password?.message ? (
              <p className="mt-1 text-sm text-rose-700">{String(form.formState.errors.password.message)}</p>
            ) : null}
          </div>

          {serverError ? <p className="text-sm text-rose-700">{serverError}</p> : null}

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {form.formState.isSubmitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="font-medium text-slate-900 underline" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
