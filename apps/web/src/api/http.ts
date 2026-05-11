import { useAuthStore } from "../store/auth.js";

function baseUrl(): string {
  const url = import.meta.env.VITE_API_URL;
  if (!url || !String(url).trim()) {
    throw new Error(
      "Missing VITE_API_URL. Copy apps/web/.env.example to apps/web/.env and set VITE_API_URL (see README)."
    );
  }
  return String(url).replace(/\/+$/, "");
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const token = useAuthStore.getState().token;
  const h = new Headers(headers);
  h.set("Accept", "application/json");
  if (rest.body && !h.has("Content-Type")) {
    h.set("Content-Type", "application/json");
  }
  if (auth) {
    if (!token) throw new Error("Not signed in.");
    h.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...rest,
    headers: h
  });

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      useAuthStore.getState().clear();
    }
    const msg =
      typeof json === "object" && json !== null && "message" in json && typeof (json as { message?: unknown }).message === "string"
        ? (json as { message: string }).message
        : text?.slice(0, 300) || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return json as T;
}
