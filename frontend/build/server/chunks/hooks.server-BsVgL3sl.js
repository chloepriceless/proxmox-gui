const BACKEND_URL = process.env.PROXMOX_GUI_BACKEND_URL ?? "http://127.0.0.1:8000";
const handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith("/api/")) {
    const upstream = `${BACKEND_URL}${event.url.pathname}${event.url.search}`;
    const headers = new Headers(event.request.headers);
    headers.delete("host");
    const init = {
      method: event.request.method,
      headers,
      redirect: "manual"
    };
    if (event.request.method !== "GET" && event.request.method !== "HEAD") {
      init.body = await event.request.arrayBuffer();
    }
    return fetch(upstream, init);
  }
  event.locals.user = null;
  try {
    const res = await event.fetch("/api/v1/me/");
    if (res.ok) {
      event.locals.user = await res.json();
    }
  } catch {
  }
  return resolve(event);
};

export { handle };
//# sourceMappingURL=hooks.server-BsVgL3sl.js.map
