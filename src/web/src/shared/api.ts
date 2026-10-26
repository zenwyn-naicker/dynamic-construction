import { useEffect, useState } from "react";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let token = "";
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const form = body instanceof FormData;
  let response: Response;
  try {
    if (method !== "GET" && !token) {
      const r = await fetch("/api/auth/csrf", { credentials: "include" });
      if (!r.ok) throw new ApiError("Cannot connect. Please retry.", r.status);
      token = (await r.json()).token;
    }
    response = await fetch("/api" + path, {
      method,
      signal,
      credentials: "include",
      headers: {
        ...(!form && body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(method !== "GET" ? { "X-CSRF-TOKEN": token } : {}),
      },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Connection unavailable. Your input has been retained; please retry.",
      0,
    );
  }
  if (!response.ok) {
    if (response.status === 401) {
      token = "";
      window.dispatchEvent(new Event("session-expired"));
    }
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.title || `Request failed (${response.status}). Please retry.`,
      response.status,
    );
  }
  if (path.startsWith("/auth/login") || path.startsWith("/auth/logout"))
    token = "";
  return response.status === 204 ? (undefined as T) : response.json();
}
export function useQuery<T>(path: string | null) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (path === null) {
      setData(undefined);
      setError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    api<T>(path, "GET", undefined, controller.signal)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) {
          setData(undefined);
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, revision]);
  return { data, error, loading, reload: () => setRevision((x) => x + 1) };
}
export const money = (value: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(value);
export const date = (value: string) =>
  new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
