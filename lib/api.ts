/**
 * Single API client for the Jivsetu backend.
 *
 * NEXT_PUBLIC_API_URL is inlined at build time. Production builds have no
 * localhost fallback: if the variable is missing, requests fail with an
 * explicit configuration error instead of silently calling the wrong host.
 */

const configured = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
export const API_URL =
  configured || (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:8001" : "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
  get isNetwork() {
    return this.status === 0;
  }
  get isAuth() {
    return this.status === 401;
  }
}

type Unauthorized = () => void;
let onUnauthorized: Unauthorized | null = null;
export function setUnauthorizedHandler(handler: Unauthorized | null) {
  onUnauthorized = handler;
}

export const NETWORK_MESSAGE = "We can't reach the Jivsetu server right now. Check your connection and try again.";

function messageFrom(data: unknown, status: number): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "message" in detail) return String((detail as { message: unknown }).message);
  }
  if (status === 503) return "The service is temporarily unavailable. Please try again shortly.";
  if (status >= 500) return "Something went wrong on the server. Please try again.";
  return `Request failed (${status}).`;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string | null;
  json?: unknown;
  form?: FormData | URLSearchParams;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!API_URL) throw new ApiError("The API address is not configured. Set NEXT_PUBLIC_API_URL and rebuild.", 0);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(NETWORK_MESSAGE, 0);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && opts.token && onUnauthorized) onUnauthorized();
    throw new ApiError(messageFrom(data, res.status), res.status);
  }
  return data as T;
}

/** Upload with real progress events (fetch cannot report upload progress). */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  token: string | null,
  onProgress: (fraction: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!API_URL) return reject(new ApiError("The API address is not configured.", 0));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError(NETWORK_MESSAGE, 0));
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else {
        if (xhr.status === 401 && onUnauthorized) onUnauthorized();
        reject(new ApiError(messageFrom(data, xhr.status), xhr.status));
      }
    };
    xhr.send(form);
  });
}

/** Fetch a protected file and open it in a new tab via an object URL. */
export async function openProtectedFile(path: string, token: string) {
  const win = window.open("", "_blank");
  try {
    const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new ApiError(res.status === 404 ? "The file could not be found." : "Unable to open the file.", res.status);
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    win?.close();
    throw err instanceof ApiError ? err : new ApiError(NETWORK_MESSAGE, 0);
  }
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof ApiError) return err.message;
  return fallback;
}
