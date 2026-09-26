
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const csrf = typeof document !== "undefined"
    ? document.cookie.split("; ").find(v => v.startsWith("lw_csrf="))?.split("=")[1]
    : undefined;
  if (csrf) headers.set("X-CSRF-Token", decodeURIComponent(csrf));
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store"
  });
  if (!response.ok) {
    let message = "Request failed.";
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  return response.json();
}
