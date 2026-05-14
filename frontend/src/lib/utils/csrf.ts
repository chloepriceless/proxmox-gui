// CSRF helper — double-submit-cookie pattern (decision D-13).
//
// The backend mints a `csrf_token` cookie on login/refresh. It is JS-readable
// BY DESIGN: the frontend reads it and echoes it back via the X-CSRF-Token
// header on state-changing requests. The server compares header to cookie;
// equality is the authority. An attacker without same-origin JS cannot read
// the cookie due to browser cookie isolation, so the pattern resists CSRF
// without leaking session credentials (those live in httpOnly cookies).

const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * Returns the value of the `csrf_token` cookie or null on the server / when
 * the cookie is absent. Safe to call during SSR — returns null there.
 */
export function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const c of cookies) {
    const eq = c.indexOf('=');
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
