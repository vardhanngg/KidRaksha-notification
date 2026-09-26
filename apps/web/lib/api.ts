export type ApiErrorShape = {
  message: string;
  code?: string;
  requestId?: string;
  status: number;
};

export class ApiError extends Error {
  code?: string;
  requestId?: string;
  status: number;
  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = "ApiError";
    this.code = shape.code;
    this.requestId = shape.requestId;
    this.status = shape.status;
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const csrf = typeof document !== "undefined"
    ? document.cookie.split("; ").map(v => v.trim())
        .find(v => v.startsWith("__Host-kidraksha_csrf=") || v.startsWith("kidraksha_csrf="))
        ?.split("=")[1]
    : undefined;
  if (csrf) headers.set("X-CSRF-Token", decodeURIComponent(csrf));
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store"
  });
  if (!response.ok) {
    let payload: any = null;
    try { payload = await response.json(); } catch {}
    const message = typeof payload?.error === "string" ? payload.error : `Request failed with status ${response.status}.`;
    throw new ApiError({ message, code: payload?.code, requestId: payload?.requestId || response.headers.get("X-Request-ID") || undefined, status: response.status });
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
