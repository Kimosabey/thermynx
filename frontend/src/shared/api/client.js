/**
 * Thin fetch wrapper — optional X-API-Key header for deployments that set API_KEYS backend-side.
 */

export function augmentFetchInit(init = {}) {
  const next = { ...init };
  const headers = new Headers(init.headers ?? {});
  const key = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_KEY;
  if (key) {
    headers.set("X-API-Key", String(key));
  }
  next.headers = headers;
  return next;
}

export async function apiFetch(url, init = {}) {
  return fetch(url, augmentFetchInit(init));
}
