/**
 * Thin client used by React Query hooks. Routes are proxied via next.config.mjs
 * so the browser only ever talks to /api/*; the Next middleware injects dev
 * auth headers before forwarding to the upstream service.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
      else if (body?.error) message = body.error;
    } catch {
      // body is not JSON; keep the default status-line message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
