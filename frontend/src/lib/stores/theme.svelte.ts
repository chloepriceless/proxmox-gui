// Theme store — tri-state (light / dark / system) using Svelte 5 runes.
//
// Contract: per UI-SPEC §Theme Toggle Contract.
//   - localStorage key 'theme' holds 'light' | 'dark' | 'system' (or absent)
//   - 'system' (or absent) resolves via window.matchMedia
//   - The `dark` class is applied to <html> when the effective mode is dark
//   - app.html ships an inline script that applies the class synchronously
//     BEFORE first paint to prevent FOUC; this store is the runtime owner.
//
// SSR safety: the class is a $state rune so the store can be imported on the
// server. init() / setMode() are guarded by `typeof window` checks; on the
// server they are no-ops.

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';
const VALID_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (VALID_MODES as readonly string[]).includes(value);
}

class ThemeStore {
  /** User's selected preference. Defaults to 'system' before init(). */
  mode: ThemeMode = $state('system');

  /** Memoised "what the user's OS reports right now". Updated by init(). */
  private systemPrefersDark: boolean = $state(false);

  /** Resolved mode — 'light' or 'dark' — never 'system'. */
  effective: 'light' | 'dark' = $derived(
    this.mode === 'system' ? (this.systemPrefersDark ? 'dark' : 'light') : this.mode
  );

  /**
   * Read persisted preference from localStorage, subscribe to the
   * prefers-color-scheme media query, and align the <html> class with the
   * computed effective mode. Safe to call multiple times.
   */
  init(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isThemeMode(stored)) {
        this.mode = stored;
      } else {
        this.mode = 'system';
      }
    } catch {
      // localStorage may throw in private mode / sandboxed iframes
      this.mode = 'system';
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPrefersDark = mq.matches;
    // Modern browsers ship addEventListener; legacy Safari needs addListener.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', (e) => {
        this.systemPrefersDark = e.matches;
        if (this.mode === 'system') this.applyClass();
      });
    }

    this.applyClass();
  }

  /**
   * Update the preference and persist it. 'system' removes the localStorage
   * key per UI-SPEC §Theme Toggle Contract.
   */
  setMode(mode: ThemeMode): void {
    if (!isThemeMode(mode)) return;
    this.mode = mode;
    if (typeof window === 'undefined') return;
    try {
      if (mode === 'system') {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, mode);
      }
    } catch {
      // Persistence failure is non-fatal — the in-memory state still applies.
    }
    this.applyClass();
  }

  private applyClass(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', this.effective === 'dark');
  }
}

export const theme = new ThemeStore();
