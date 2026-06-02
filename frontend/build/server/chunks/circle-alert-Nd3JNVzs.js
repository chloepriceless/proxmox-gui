import { o as spread_props } from './renderer-mZFfBJIU.js';
import { I as Icon } from './Icon-oF8immWv.js';

function Circle_alert($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["line", { "x1": "12", "x2": "12", "y1": "8", "y2": "12" }],
    [
      "line",
      { "x1": "12", "x2": "12.01", "y1": "16", "y2": "16" }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "circle-alert" }, props, { iconNode }]));
}

export { Circle_alert as C };
//# sourceMappingURL=circle-alert-Nd3JNVzs.js.map
