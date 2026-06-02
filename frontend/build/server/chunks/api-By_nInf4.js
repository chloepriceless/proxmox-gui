const CSRF_COOKIE_NAME = "csrf_token";
function readCsrfCookie() {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const c of cookies) {
    const eq = c.indexOf("=");
    if (eq === -1) continue;
    const name = c.slice(0, eq);
    if (name === CSRF_COOKIE_NAME) {
      try {
        return decodeURIComponent(c.slice(eq + 1));
      } catch {
        return c.slice(eq + 1);
      }
    }
  }
  return null;
}
const API_PREFIX = "/api/v1";
const STATE_CHANGING = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
class ApiError extends Error {
  status;
  body;
  constructor(status, message, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}
function buildUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/api")) return path;
  if (!path.startsWith("/")) return `${API_PREFIX}/${path}`;
  return `${API_PREFIX}${path}`;
}
async function apiFetch(path, init = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  let body = void 0;
  if (init.body !== void 0 && init.body !== null) {
    if (typeof init.body === "string" || init.body instanceof FormData || init.body instanceof Blob || init.body instanceof ArrayBuffer || init.body instanceof URLSearchParams || typeof ReadableStream !== "undefined" && init.body instanceof ReadableStream) {
      body = init.body;
    } else {
      body = JSON.stringify(init.body);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    }
  }
  if (STATE_CHANGING.has(method)) {
    const token = readCsrfCookie();
    if (token && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", token);
    }
  }
  const fetchImpl = init._fetch ?? fetch;
  const forwarded = { ...init };
  delete forwarded._fetch;
  return fetchImpl(buildUrl(path), {
    ...forwarded,
    method,
    headers,
    body,
    credentials: init.credentials ?? "same-origin"
  });
}
async function apiJson(path, init = {}) {
  const res = await apiFetch(path, init);
  let parsed = null;
  const text = await res.text();
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const message = typeof parsed === "object" && parsed !== null && "detail" in parsed ? String(parsed.detail) : `Request failed: ${res.status}`;
    if (res.status === 401 && message === "session_idle_expired" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("session_idle_expired"));
    }
    throw new ApiError(res.status, message, parsed);
  }
  return parsed;
}

export { ApiError, apiFetch, apiJson };
//# sourceMappingURL=api-By_nInf4.js.map
