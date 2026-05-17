import { aB as head } from './renderer--hvGDOOw.js';
import 'clsx';

let _logLevel = "warn";
let Info = () => {
};
let Warn = () => {
};
let Error$1 = () => {
};
function initLogging(level) {
  if (typeof level === "undefined") {
    level = _logLevel;
  } else {
    _logLevel = level;
  }
  Info = Warn = Error$1 = () => {
  };
  if (typeof window.console !== "undefined") {
    switch (level) {
      case "debug":
        console.debug.bind(window.console);
      case "info":
        Info = console.info.bind(window.console);
      case "warn":
        Warn = console.warn.bind(window.console);
      case "error":
        Error$1 = console.error.bind(window.console);
      case "none":
        break;
      default:
        throw new window.Error("invalid logging type '" + level + "'");
    }
  }
}
initLogging();
const Base64 = {
  /* Convert data (an array of integers) to a Base64 string. */
  toBase64Table: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".split(""),
  base64Pad: "=",
  encode(data) {
    let result = "";
    const length = data.length;
    const lengthpad = length % 3;
    for (let i = 0; i < length - 2; i += 3) {
      result += this.toBase64Table[data[i] >> 2];
      result += this.toBase64Table[((data[i] & 3) << 4) + (data[i + 1] >> 4)];
      result += this.toBase64Table[((data[i + 1] & 15) << 2) + (data[i + 2] >> 6)];
      result += this.toBase64Table[data[i + 2] & 63];
    }
    const j = length - lengthpad;
    if (lengthpad === 2) {
      result += this.toBase64Table[data[j] >> 2];
      result += this.toBase64Table[((data[j] & 3) << 4) + (data[j + 1] >> 4)];
      result += this.toBase64Table[(data[j + 1] & 15) << 2];
      result += this.toBase64Table[64];
    } else if (lengthpad === 1) {
      result += this.toBase64Table[data[j] >> 2];
      result += this.toBase64Table[(data[j] & 3) << 4];
      result += this.toBase64Table[64];
      result += this.toBase64Table[64];
    }
    return result;
  },
  /* Convert Base64 data to a string */
  /* eslint-disable comma-spacing */
  toBinaryTable: [
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    62,
    -1,
    -1,
    -1,
    63,
    52,
    53,
    54,
    55,
    56,
    57,
    58,
    59,
    60,
    61,
    -1,
    -1,
    -1,
    0,
    -1,
    -1,
    -1,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    26,
    27,
    28,
    29,
    30,
    31,
    32,
    33,
    34,
    35,
    36,
    37,
    38,
    39,
    40,
    41,
    42,
    43,
    44,
    45,
    46,
    47,
    48,
    49,
    50,
    51,
    -1,
    -1,
    -1,
    -1,
    -1
  ],
  /* eslint-enable comma-spacing */
  decode(data, offset = 0) {
    let dataLength = data.indexOf("=") - offset;
    if (dataLength < 0) {
      dataLength = data.length - offset;
    }
    const resultLength = (dataLength >> 2) * 3 + Math.floor(dataLength % 4 / 1.5);
    const result = new Array(resultLength);
    let leftbits = 0;
    let leftdata = 0;
    for (let idx = 0, i = offset; i < data.length; i++) {
      const c = this.toBinaryTable[data.charCodeAt(i) & 127];
      const padding = data.charAt(i) === this.base64Pad;
      if (c === -1) {
        Error$1("Illegal character code " + data.charCodeAt(i) + " at position " + i);
        continue;
      }
      leftdata = leftdata << 6 | c;
      leftbits += 6;
      if (leftbits >= 8) {
        leftbits -= 8;
        if (!padding) {
          result[idx++] = leftdata >> leftbits & 255;
        }
        leftdata &= (1 << leftbits) - 1;
      }
    }
    if (leftbits) {
      const err = new Error("Corrupted base64 string");
      err.name = "Base64-Error";
      throw err;
    }
    return result;
  }
};
window.addEventListener("touchstart", function onFirstTouch() {
  window.removeEventListener("touchstart", onFirstTouch, false);
}, false);
let _supportsCursorURIs = false;
try {
  const target = document.createElement("canvas");
  target.style.cursor = 'url("data:image/x-icon;base64,AAACAAEACAgAAAIAAgA4AQAAFgAAACgAAAAIAAAAEAAAAAEAIAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAD/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AAAAAAAAAAAAAAAAAAAAAA==") 2 2, default';
  if (target.style.cursor.indexOf("url") === 0) {
    Info("Data URI scheme cursor supported");
    _supportsCursorURIs = true;
  } else {
    Warn("Data URI scheme cursor not supported");
  }
} catch (exc) {
  Error$1("Data URI scheme cursor test exception: " + exc);
}
let _hasScrollbarGutter = true;
try {
  const container = document.createElement("div");
  container.style.visibility = "hidden";
  container.style.overflow = "scroll";
  document.body.appendChild(container);
  const child = document.createElement("div");
  container.appendChild(child);
  const scrollbarWidth = container.offsetWidth - child.offsetWidth;
  container.parentNode.removeChild(container);
  _hasScrollbarGutter = scrollbarWidth != 0;
} catch (exc) {
  Error$1("Scrollbar test exception: " + exc);
}
async function _checkWebCodecsH264DecodeSupport() {
  if (!("VideoDecoder" in window)) {
    return false;
  }
  const config = {
    codec: "avc1.42401f",
    codedWidth: 1920,
    codedHeight: 1080,
    optimizeForLatency: true
  };
  let support = await VideoDecoder.isConfigSupported(config);
  if (!support.supported) {
    return false;
  }
  const data = new Uint8Array(Base64.decode(
    "AAAAAWdCwBTZnpuAgICgAAADACAAAAZB4oVNAAAAAWjJYyyAAAABBgX//4HcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9NSBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgxOjB4MTExIG1lPWhleCBzdWJtZT04IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0yIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD1pbmZpbml0ZSBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NTAgcmM9YWJyIG1idHJlZT0xIGJpdHJhdGU9NDAwIHJhdGV0b2w9MS4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAABZYiEBrxmKAAPVccAAS044AA5DRJMnkycJk4TPw=="
  ));
  let gotframe = false;
  let error = null;
  let decoder = new VideoDecoder({
    output: (frame) => {
      gotframe = true;
    },
    error: (e) => {
      error = e;
    }
  });
  let chunk = new EncodedVideoChunk({
    timestamp: 0,
    type: "key",
    data
  });
  decoder.configure(config);
  decoder.decode(chunk);
  try {
    await decoder.flush();
  } catch (e) {
    error = e;
  }
  if (!gotframe) {
    return false;
  }
  if (error !== null) {
    return false;
  }
  return true;
}
await _checkWebCodecsH264DecodeSupport();
document.captureElement = null;
function _capturedElemChanged() {
  const proxyElem = document.getElementById("noVNC_mouse_capture_elem");
  proxyElem.style.cursor = window.getComputedStyle(document.captureElement).cursor;
}
new MutationObserver(_capturedElemChanged);
function zero(buf) {
  var len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
}
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var LENGTH_CODES = 29;
var LITERALS = 256;
var L_CODES = LITERALS + 1 + LENGTH_CODES;
var D_CODES = 30;
var DIST_CODE_LEN = 512;
var static_ltree = new Array((L_CODES + 2) * 2);
zero(static_ltree);
var static_dtree = new Array(D_CODES * 2);
zero(static_dtree);
var _dist_code = new Array(DIST_CODE_LEN);
zero(_dist_code);
var _length_code = new Array(MAX_MATCH - MIN_MATCH + 1);
zero(_length_code);
var base_length = new Array(LENGTH_CODES);
zero(base_length);
var base_dist = new Array(D_CODES);
zero(base_dist);
const KeyTable = {
  XK_BackSpace: 65288,
  /* Back space, back char */
  XK_Tab: 65289,
  XK_Clear: 65291,
  XK_Return: 65293,
  /* Return, enter */
  XK_Pause: 65299,
  /* Pause, hold */
  XK_Scroll_Lock: 65300,
  XK_Escape: 65307,
  XK_Delete: 65535,
  /* Delete, rubout */
  /* International & multi-key character composition */
  XK_Multi_key: 65312,
  /* Multi-key character compose */
  XK_Codeinput: 65335,
  XK_SingleCandidate: 65340,
  XK_MultipleCandidate: 65341,
  XK_PreviousCandidate: 65342,
  /* Japanese keyboard support */
  XK_Kanji: 65313,
  /* Kanji, Kanji convert */
  XK_Muhenkan: 65314,
  /* Cancel Conversion */
  XK_Henkan: 65315,
  /* Alias for Henkan_Mode */
  XK_Romaji: 65316,
  /* to Romaji */
  XK_Hiragana: 65317,
  /* to Hiragana */
  XK_Katakana: 65318,
  /* to Katakana */
  XK_Hiragana_Katakana: 65319,
  /* Hiragana/Katakana toggle */
  XK_Zenkaku: 65320,
  /* to Zenkaku */
  XK_Hankaku: 65321,
  /* to Hankaku */
  XK_Zenkaku_Hankaku: 65322,
  /* Zenkaku/Hankaku toggle */
  XK_Kana_Shift: 65326,
  /* Kana Shift */
  XK_Eisu_toggle: 65328,
  /* Alphanumeric toggle */
  /* Cursor control & motion */
  XK_Home: 65360,
  XK_Left: 65361,
  /* Move left, left arrow */
  XK_Up: 65362,
  /* Move up, up arrow */
  XK_Right: 65363,
  /* Move right, right arrow */
  XK_Down: 65364,
  /* Move down, down arrow */
  XK_Prior: 65365,
  /* Prior, previous */
  XK_Next: 65366,
  /* Next */
  XK_End: 65367,
  /* EOL */
  /* Misc functions */
  XK_Select: 65376,
  /* Select, mark */
  XK_Print: 65377,
  XK_Execute: 65378,
  /* Execute, run, do */
  XK_Insert: 65379,
  /* Insert, insert here */
  XK_Undo: 65381,
  XK_Redo: 65382,
  /* Redo, again */
  XK_Menu: 65383,
  XK_Find: 65384,
  /* Find, search */
  XK_Cancel: 65385,
  /* Cancel, stop, abort, exit */
  XK_Help: 65386,
  /* Help */
  XK_Num_Lock: 65407,
  /* Keypad functions, keypad numbers cleverly chosen to map to ASCII */
  XK_KP_Space: 65408,
  /* Space */
  XK_KP_Enter: 65421,
  /* Enter */
  XK_KP_Home: 65429,
  XK_KP_Left: 65430,
  XK_KP_Up: 65431,
  XK_KP_Right: 65432,
  XK_KP_Down: 65433,
  XK_KP_Prior: 65434,
  XK_KP_Next: 65435,
  XK_KP_End: 65436,
  XK_KP_Begin: 65437,
  XK_KP_Insert: 65438,
  XK_KP_Delete: 65439,
  XK_KP_Equal: 65469,
  /* Equals */
  XK_KP_Multiply: 65450,
  XK_KP_Add: 65451,
  XK_KP_Separator: 65452,
  /* Separator, often comma */
  XK_KP_Subtract: 65453,
  XK_KP_Decimal: 65454,
  XK_KP_Divide: 65455,
  XK_KP_0: 65456,
  XK_KP_1: 65457,
  XK_KP_2: 65458,
  XK_KP_3: 65459,
  XK_KP_4: 65460,
  XK_KP_5: 65461,
  XK_KP_6: 65462,
  XK_KP_7: 65463,
  XK_KP_8: 65464,
  XK_KP_9: 65465,
  /*
   * Auxiliary functions; note the duplicate definitions for left and right
   * function keys;  Sun keyboards and a few other manufacturers have such
   * function key groups on the left and/or right sides of the keyboard.
   * We've not found a keyboard with more than 35 function keys total.
   */
  XK_F1: 65470,
  XK_F2: 65471,
  XK_F3: 65472,
  XK_F4: 65473,
  XK_F5: 65474,
  XK_F6: 65475,
  XK_F7: 65476,
  XK_F8: 65477,
  XK_F9: 65478,
  XK_F10: 65479,
  XK_F11: 65480,
  XK_F12: 65481,
  XK_F13: 65482,
  XK_F14: 65483,
  XK_F15: 65484,
  XK_F16: 65485,
  XK_F17: 65486,
  XK_F18: 65487,
  XK_F19: 65488,
  XK_F20: 65489,
  XK_F21: 65490,
  XK_F22: 65491,
  XK_F23: 65492,
  XK_F24: 65493,
  XK_F25: 65494,
  XK_F26: 65495,
  XK_F27: 65496,
  XK_F28: 65497,
  XK_F29: 65498,
  XK_F30: 65499,
  XK_F31: 65500,
  XK_F32: 65501,
  XK_F33: 65502,
  XK_F34: 65503,
  XK_F35: 65504,
  /* Modifiers */
  XK_Shift_L: 65505,
  /* Left shift */
  XK_Shift_R: 65506,
  /* Right shift */
  XK_Control_L: 65507,
  /* Left control */
  XK_Control_R: 65508,
  /* Right control */
  XK_Caps_Lock: 65509,
  /* Caps lock */
  XK_Alt_L: 65513,
  /* Left alt */
  XK_Alt_R: 65514,
  /* Right alt */
  XK_Super_L: 65515,
  /* Left super */
  XK_Super_R: 65516,
  /* Right super */
  /*
   * Keyboard (XKB) Extension function and modifier keys
   * (from Appendix C of "The X Keyboard Extension: Protocol Specification")
   * Byte 3 = 0xfe
   */
  XK_ISO_Level3_Shift: 65027,
  /* AltGr */
  XK_ISO_Next_Group: 65032,
  XK_ISO_Prev_Group: 65034,
  XK_ISO_First_Group: 65036,
  XK_ISO_Last_Group: 65038,
  /*
   * Latin 1
   * (ISO/IEC 8859-1: Unicode U+0020..U+00FF)
   * Byte 3: 0
   */
  XK_space: 32,
  /* U+0020 SPACE */
  XK_asterisk: 42,
  /* U+002A ASTERISK */
  XK_plus: 43,
  /* U+002B PLUS SIGN */
  XK_comma: 44,
  /* U+002C COMMA */
  XK_minus: 45,
  /* U+002D HYPHEN-MINUS */
  XK_period: 46,
  /* U+002E FULL STOP */
  XK_slash: 47,
  /* U+002F SOLIDUS */
  XK_0: 48,
  /* U+0030 DIGIT ZERO */
  XK_1: 49,
  /* U+0031 DIGIT ONE */
  XK_2: 50,
  /* U+0032 DIGIT TWO */
  XK_3: 51,
  /* U+0033 DIGIT THREE */
  XK_4: 52,
  /* U+0034 DIGIT FOUR */
  XK_5: 53,
  /* U+0035 DIGIT FIVE */
  XK_6: 54,
  /* U+0036 DIGIT SIX */
  XK_7: 55,
  /* U+0037 DIGIT SEVEN */
  XK_8: 56,
  /* U+0038 DIGIT EIGHT */
  XK_9: 57,
  /* U+0039 DIGIT NINE */
  XK_equal: 61,
  /* U+003D EQUALS SIGN */
  /*
   * Korean
   * Byte 3 = 0x0e
   */
  XK_Hangul: 65329,
  /* Hangul start/stop(toggle) */
  XK_Hangul_Hanja: 65332,
  /* Start Hangul->Hanja Conversion */
  XK_Hangul_Jeonja: 65336,
  /* Jeonja mode */
  XF86XK_MonBrightnessUp: 269025026,
  XF86XK_MonBrightnessDown: 269025027,
  XF86XK_Standby: 269025040,
  XF86XK_AudioLowerVolume: 269025041,
  XF86XK_AudioMute: 269025042,
  XF86XK_AudioRaiseVolume: 269025043,
  XF86XK_AudioPlay: 269025044,
  XF86XK_AudioStop: 269025045,
  XF86XK_AudioPrev: 269025046,
  XF86XK_AudioNext: 269025047,
  XF86XK_HomePage: 269025048,
  XF86XK_Mail: 269025049,
  XF86XK_Search: 269025051,
  XF86XK_AudioRecord: 269025052,
  XF86XK_Calculator: 269025053,
  XF86XK_Calendar: 269025056,
  XF86XK_PowerDown: 269025057,
  XF86XK_Back: 269025062,
  XF86XK_Forward: 269025063,
  XF86XK_Stop: 269025064,
  XF86XK_Refresh: 269025065,
  XF86XK_PowerOff: 269025066,
  XF86XK_WakeUp: 269025067,
  XF86XK_Eject: 269025068,
  XF86XK_ScreenSaver: 269025069,
  XF86XK_WWW: 269025070,
  XF86XK_Favorites: 269025072,
  XF86XK_AudioPause: 269025073,
  XF86XK_AudioMedia: 269025074,
  XF86XK_MyComputer: 269025075,
  XF86XK_BrightnessAdjust: 269025083,
  XF86XK_AudioRewind: 269025086,
  XF86XK_Close: 269025110,
  XF86XK_Copy: 269025111,
  XF86XK_Cut: 269025112,
  XF86XK_Excel: 269025116,
  XF86XK_LogOff: 269025121,
  XF86XK_New: 269025128,
  XF86XK_Open: 269025131,
  XF86XK_Paste: 269025133,
  XF86XK_Phone: 269025134,
  XF86XK_Reply: 269025138,
  XF86XK_Save: 269025143,
  XF86XK_Send: 269025147,
  XF86XK_Spell: 269025148,
  XF86XK_SplitScreen: 269025149,
  XF86XK_Word: 269025161,
  XF86XK_ZoomIn: 269025163,
  XF86XK_ZoomOut: 269025164,
  XF86XK_WebCam: 269025167,
  XF86XK_MailForward: 269025168,
  XF86XK_Music: 269025170,
  XF86XK_AudioForward: 269025175,
  XF86XK_AudioRandomPlay: 269025177,
  XF86XK_Subtitle: 269025178,
  XF86XK_AudioCycleTrack: 269025179,
  XF86XK_Hibernate: 269025192,
  XF86XK_AudioMicMute: 269025202,
  XF86XK_Next_VMode: 269024802
};
const DOMKeyTable = {};
function addStandard(key, standard) {
  if (standard === void 0) throw new Error('Undefined keysym for key "' + key + '"');
  if (key in DOMKeyTable) throw new Error('Duplicate entry for key "' + key + '"');
  DOMKeyTable[key] = [standard, standard, standard, standard];
}
function addLeftRight(key, left, right) {
  if (left === void 0) throw new Error('Undefined keysym for key "' + key + '"');
  if (right === void 0) throw new Error('Undefined keysym for key "' + key + '"');
  if (key in DOMKeyTable) throw new Error('Duplicate entry for key "' + key + '"');
  DOMKeyTable[key] = [left, left, right, left];
}
function addNumpad(key, standard, numpad) {
  if (standard === void 0) throw new Error('Undefined keysym for key "' + key + '"');
  if (numpad === void 0) throw new Error('Undefined keysym for key "' + key + '"');
  if (key in DOMKeyTable) throw new Error('Duplicate entry for key "' + key + '"');
  DOMKeyTable[key] = [standard, standard, standard, numpad];
}
addLeftRight("Alt", KeyTable.XK_Alt_L, KeyTable.XK_Alt_R);
addStandard("AltGraph", KeyTable.XK_ISO_Level3_Shift);
addStandard("CapsLock", KeyTable.XK_Caps_Lock);
addLeftRight("Control", KeyTable.XK_Control_L, KeyTable.XK_Control_R);
addLeftRight("Meta", KeyTable.XK_Super_L, KeyTable.XK_Super_R);
addStandard("NumLock", KeyTable.XK_Num_Lock);
addStandard("ScrollLock", KeyTable.XK_Scroll_Lock);
addLeftRight("Shift", KeyTable.XK_Shift_L, KeyTable.XK_Shift_R);
addNumpad("Enter", KeyTable.XK_Return, KeyTable.XK_KP_Enter);
addStandard("Tab", KeyTable.XK_Tab);
addNumpad(" ", KeyTable.XK_space, KeyTable.XK_KP_Space);
addNumpad("ArrowDown", KeyTable.XK_Down, KeyTable.XK_KP_Down);
addNumpad("ArrowLeft", KeyTable.XK_Left, KeyTable.XK_KP_Left);
addNumpad("ArrowRight", KeyTable.XK_Right, KeyTable.XK_KP_Right);
addNumpad("ArrowUp", KeyTable.XK_Up, KeyTable.XK_KP_Up);
addNumpad("End", KeyTable.XK_End, KeyTable.XK_KP_End);
addNumpad("Home", KeyTable.XK_Home, KeyTable.XK_KP_Home);
addNumpad("PageDown", KeyTable.XK_Next, KeyTable.XK_KP_Next);
addNumpad("PageUp", KeyTable.XK_Prior, KeyTable.XK_KP_Prior);
addStandard("Backspace", KeyTable.XK_BackSpace);
addNumpad("Clear", KeyTable.XK_Clear, KeyTable.XK_KP_Begin);
addStandard("Copy", KeyTable.XF86XK_Copy);
addStandard("Cut", KeyTable.XF86XK_Cut);
addNumpad("Delete", KeyTable.XK_Delete, KeyTable.XK_KP_Delete);
addNumpad("Insert", KeyTable.XK_Insert, KeyTable.XK_KP_Insert);
addStandard("Paste", KeyTable.XF86XK_Paste);
addStandard("Redo", KeyTable.XK_Redo);
addStandard("Undo", KeyTable.XK_Undo);
addStandard("Cancel", KeyTable.XK_Cancel);
addStandard("ContextMenu", KeyTable.XK_Menu);
addStandard("Escape", KeyTable.XK_Escape);
addStandard("Execute", KeyTable.XK_Execute);
addStandard("Find", KeyTable.XK_Find);
addStandard("Help", KeyTable.XK_Help);
addStandard("Pause", KeyTable.XK_Pause);
addStandard("Select", KeyTable.XK_Select);
addStandard("ZoomIn", KeyTable.XF86XK_ZoomIn);
addStandard("ZoomOut", KeyTable.XF86XK_ZoomOut);
addStandard("BrightnessDown", KeyTable.XF86XK_MonBrightnessDown);
addStandard("BrightnessUp", KeyTable.XF86XK_MonBrightnessUp);
addStandard("Eject", KeyTable.XF86XK_Eject);
addStandard("LogOff", KeyTable.XF86XK_LogOff);
addStandard("Power", KeyTable.XF86XK_PowerOff);
addStandard("PowerOff", KeyTable.XF86XK_PowerDown);
addStandard("PrintScreen", KeyTable.XK_Print);
addStandard("Hibernate", KeyTable.XF86XK_Hibernate);
addStandard("Standby", KeyTable.XF86XK_Standby);
addStandard("WakeUp", KeyTable.XF86XK_WakeUp);
addStandard("AllCandidates", KeyTable.XK_MultipleCandidate);
addStandard("Alphanumeric", KeyTable.XK_Eisu_toggle);
addStandard("CodeInput", KeyTable.XK_Codeinput);
addStandard("Compose", KeyTable.XK_Multi_key);
addStandard("Convert", KeyTable.XK_Henkan);
addStandard("GroupFirst", KeyTable.XK_ISO_First_Group);
addStandard("GroupLast", KeyTable.XK_ISO_Last_Group);
addStandard("GroupNext", KeyTable.XK_ISO_Next_Group);
addStandard("GroupPrevious", KeyTable.XK_ISO_Prev_Group);
addStandard("NonConvert", KeyTable.XK_Muhenkan);
addStandard("PreviousCandidate", KeyTable.XK_PreviousCandidate);
addStandard("SingleCandidate", KeyTable.XK_SingleCandidate);
addStandard("HangulMode", KeyTable.XK_Hangul);
addStandard("HanjaMode", KeyTable.XK_Hangul_Hanja);
addStandard("JunjaMode", KeyTable.XK_Hangul_Jeonja);
addStandard("Eisu", KeyTable.XK_Eisu_toggle);
addStandard("Hankaku", KeyTable.XK_Hankaku);
addStandard("Hiragana", KeyTable.XK_Hiragana);
addStandard("HiraganaKatakana", KeyTable.XK_Hiragana_Katakana);
addStandard("KanaMode", KeyTable.XK_Kana_Shift);
addStandard("KanjiMode", KeyTable.XK_Kanji);
addStandard("Katakana", KeyTable.XK_Katakana);
addStandard("Romaji", KeyTable.XK_Romaji);
addStandard("Zenkaku", KeyTable.XK_Zenkaku);
addStandard("ZenkakuHankaku", KeyTable.XK_Zenkaku_Hankaku);
addStandard("F1", KeyTable.XK_F1);
addStandard("F2", KeyTable.XK_F2);
addStandard("F3", KeyTable.XK_F3);
addStandard("F4", KeyTable.XK_F4);
addStandard("F5", KeyTable.XK_F5);
addStandard("F6", KeyTable.XK_F6);
addStandard("F7", KeyTable.XK_F7);
addStandard("F8", KeyTable.XK_F8);
addStandard("F9", KeyTable.XK_F9);
addStandard("F10", KeyTable.XK_F10);
addStandard("F11", KeyTable.XK_F11);
addStandard("F12", KeyTable.XK_F12);
addStandard("F13", KeyTable.XK_F13);
addStandard("F14", KeyTable.XK_F14);
addStandard("F15", KeyTable.XK_F15);
addStandard("F16", KeyTable.XK_F16);
addStandard("F17", KeyTable.XK_F17);
addStandard("F18", KeyTable.XK_F18);
addStandard("F19", KeyTable.XK_F19);
addStandard("F20", KeyTable.XK_F20);
addStandard("F21", KeyTable.XK_F21);
addStandard("F22", KeyTable.XK_F22);
addStandard("F23", KeyTable.XK_F23);
addStandard("F24", KeyTable.XK_F24);
addStandard("F25", KeyTable.XK_F25);
addStandard("F26", KeyTable.XK_F26);
addStandard("F27", KeyTable.XK_F27);
addStandard("F28", KeyTable.XK_F28);
addStandard("F29", KeyTable.XK_F29);
addStandard("F30", KeyTable.XK_F30);
addStandard("F31", KeyTable.XK_F31);
addStandard("F32", KeyTable.XK_F32);
addStandard("F33", KeyTable.XK_F33);
addStandard("F34", KeyTable.XK_F34);
addStandard("F35", KeyTable.XK_F35);
addStandard("Close", KeyTable.XF86XK_Close);
addStandard("MailForward", KeyTable.XF86XK_MailForward);
addStandard("MailReply", KeyTable.XF86XK_Reply);
addStandard("MailSend", KeyTable.XF86XK_Send);
addStandard("MediaFastForward", KeyTable.XF86XK_AudioForward);
addStandard("MediaPause", KeyTable.XF86XK_AudioPause);
addStandard("MediaPlay", KeyTable.XF86XK_AudioPlay);
addStandard("MediaRecord", KeyTable.XF86XK_AudioRecord);
addStandard("MediaRewind", KeyTable.XF86XK_AudioRewind);
addStandard("MediaStop", KeyTable.XF86XK_AudioStop);
addStandard("MediaTrackNext", KeyTable.XF86XK_AudioNext);
addStandard("MediaTrackPrevious", KeyTable.XF86XK_AudioPrev);
addStandard("New", KeyTable.XF86XK_New);
addStandard("Open", KeyTable.XF86XK_Open);
addStandard("Print", KeyTable.XK_Print);
addStandard("Save", KeyTable.XF86XK_Save);
addStandard("SpellCheck", KeyTable.XF86XK_Spell);
addStandard("AudioVolumeDown", KeyTable.XF86XK_AudioLowerVolume);
addStandard("AudioVolumeUp", KeyTable.XF86XK_AudioRaiseVolume);
addStandard("AudioVolumeMute", KeyTable.XF86XK_AudioMute);
addStandard("MicrophoneVolumeMute", KeyTable.XF86XK_AudioMicMute);
addStandard("LaunchApplication1", KeyTable.XF86XK_MyComputer);
addStandard("LaunchApplication2", KeyTable.XF86XK_Calculator);
addStandard("LaunchCalendar", KeyTable.XF86XK_Calendar);
addStandard("LaunchMail", KeyTable.XF86XK_Mail);
addStandard("LaunchMediaPlayer", KeyTable.XF86XK_AudioMedia);
addStandard("LaunchMusicPlayer", KeyTable.XF86XK_Music);
addStandard("LaunchPhone", KeyTable.XF86XK_Phone);
addStandard("LaunchScreenSaver", KeyTable.XF86XK_ScreenSaver);
addStandard("LaunchSpreadsheet", KeyTable.XF86XK_Excel);
addStandard("LaunchWebBrowser", KeyTable.XF86XK_WWW);
addStandard("LaunchWebCam", KeyTable.XF86XK_WebCam);
addStandard("LaunchWordProcessor", KeyTable.XF86XK_Word);
addStandard("BrowserBack", KeyTable.XF86XK_Back);
addStandard("BrowserFavorites", KeyTable.XF86XK_Favorites);
addStandard("BrowserForward", KeyTable.XF86XK_Forward);
addStandard("BrowserHome", KeyTable.XF86XK_HomePage);
addStandard("BrowserRefresh", KeyTable.XF86XK_Refresh);
addStandard("BrowserSearch", KeyTable.XF86XK_Search);
addStandard("BrowserStop", KeyTable.XF86XK_Stop);
addStandard("Dimmer", KeyTable.XF86XK_BrightnessAdjust);
addStandard("MediaAudioTrack", KeyTable.XF86XK_AudioCycleTrack);
addStandard("RandomToggle", KeyTable.XF86XK_AudioRandomPlay);
addStandard("SplitScreenToggle", KeyTable.XF86XK_SplitScreen);
addStandard("Subtitle", KeyTable.XF86XK_Subtitle);
addStandard("VideoModeNext", KeyTable.XF86XK_Next_VMode);
addNumpad("=", KeyTable.XK_equal, KeyTable.XK_KP_Equal);
addNumpad("+", KeyTable.XK_plus, KeyTable.XK_KP_Add);
addNumpad("-", KeyTable.XK_minus, KeyTable.XK_KP_Subtract);
addNumpad("*", KeyTable.XK_asterisk, KeyTable.XK_KP_Multiply);
addNumpad("/", KeyTable.XK_slash, KeyTable.XK_KP_Divide);
addNumpad(".", KeyTable.XK_period, KeyTable.XK_KP_Decimal);
addNumpad(",", KeyTable.XK_comma, KeyTable.XK_KP_Separator);
addNumpad("0", KeyTable.XK_0, KeyTable.XK_KP_0);
addNumpad("1", KeyTable.XK_1, KeyTable.XK_KP_1);
addNumpad("2", KeyTable.XK_2, KeyTable.XK_KP_2);
addNumpad("3", KeyTable.XK_3, KeyTable.XK_KP_3);
addNumpad("4", KeyTable.XK_4, KeyTable.XK_KP_4);
addNumpad("5", KeyTable.XK_5, KeyTable.XK_KP_5);
addNumpad("6", KeyTable.XK_6, KeyTable.XK_KP_6);
addNumpad("7", KeyTable.XK_7, KeyTable.XK_KP_7);
addNumpad("8", KeyTable.XK_8, KeyTable.XK_KP_8);
addNumpad("9", KeyTable.XK_9, KeyTable.XK_KP_9);
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    head("1n9url4", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Console</title>`);
      });
    });
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="overlay svelte-1n9url4"><p>Console unavailable.</p></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-Py4eK0TJ.js.map
