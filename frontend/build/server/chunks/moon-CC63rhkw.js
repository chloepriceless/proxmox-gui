import { o as spread_props, d as derived } from './renderer-mZFfBJIU.js';
import { I as Icon } from './Icon-oF8immWv.js';

const STORAGE_KEY = "theme";
const VALID_MODES = ["light", "dark", "system"];
function isThemeMode(value) {
  return typeof value === "string" && VALID_MODES.includes(value);
}
class ThemeStore {
  /** User's selected preference. Defaults to 'system' before init(). */
  mode = "system";
  /** Memoised "what the user's OS reports right now". Updated by init(). */
  systemPrefersDark = false;
  #effective = derived(() => this.mode === "system" ? this.systemPrefersDark ? "dark" : "light" : this.mode);
  get effective() {
    return this.#effective();
  }
  set effective($$value) {
    return this.#effective($$value);
  }
  init() {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isThemeMode(stored)) {
        this.mode = stored;
      } else {
        this.mode = "system";
      }
    } catch {
      this.mode = "system";
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    this.systemPrefersDark = mq.matches;
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", (e) => {
        this.systemPrefersDark = e.matches;
        if (this.mode === "system") this.applyClass();
      });
    }
    this.applyClass();
  }
  /**
   * Update the preference and persist it. 'system' removes the localStorage
   * key per UI-SPEC §Theme Toggle Contract.
   */
  setMode(mode) {
    if (!isThemeMode(mode)) return;
    this.mode = mode;
    if (typeof window === "undefined") return;
    try {
      if (mode === "system") {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, mode);
      }
    } catch {
    }
    this.applyClass();
  }
  applyClass() {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", this.effective === "dark");
  }
}
const theme = new ThemeStore();
function Sun($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "4" }],
    ["path", { "d": "M12 2v2" }],
    ["path", { "d": "M12 20v2" }],
    ["path", { "d": "m4.93 4.93 1.41 1.41" }],
    ["path", { "d": "m17.66 17.66 1.41 1.41" }],
    ["path", { "d": "M2 12h2" }],
    ["path", { "d": "M20 12h2" }],
    ["path", { "d": "m6.34 17.66-1.41 1.41" }],
    ["path", { "d": "m19.07 4.93-1.41 1.41" }]
  ];
  Icon($$renderer, spread_props([{ name: "sun" }, props, { iconNode }]));
}
function Moon($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "moon" }, props, { iconNode }]));
}

export { Moon as M, Sun as S, theme as t };
//# sourceMappingURL=moon-CC63rhkw.js.map
