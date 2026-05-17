import { o as spread_props } from './renderer--hvGDOOw.js';
import { I as Icon } from './button-BxOVow4s.js';

function Calendar_clock($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M16 14v2.2l1.6 1" }],
    ["path", { "d": "M16 2v4" }],
    [
      "path",
      {
        "d": "M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"
      }
    ],
    ["path", { "d": "M3 10h5" }],
    ["path", { "d": "M8 2v4" }],
    ["circle", { "cx": "16", "cy": "16", "r": "6" }]
  ];
  Icon($$renderer, spread_props([{ name: "calendar-clock" }, props, { iconNode }]));
}
function Circle_check($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["path", { "d": "m9 12 2 2 4-4" }]
  ];
  Icon($$renderer, spread_props([{ name: "circle-check" }, props, { iconNode }]));
}

export { Calendar_clock as C, Circle_check as a };
//# sourceMappingURL=circle-check-DM_L2smH.js.map
