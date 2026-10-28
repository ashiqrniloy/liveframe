import type { LiveframeError } from "../errors.ts";
import type { Colour } from "./dtcg.ts";
import type { Theme } from "./theme.ts";
import type { Vocabulary } from "./vocabulary.ts";

type Triple = readonly [number, number, number];
type Matrix = readonly [Triple, Triple, Triple];
const multiply = (m: Matrix, v: Triple): Triple => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const map = (v: Triple, f: (n: number) => number): Triple => [f(v[0]), f(v[1]), f(v[2])];
const linear = (n: number) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
const encoded = (n: number) => (n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055);

// CSS Color 4 2025-04-24 §18 sample matrices; Rec.2020 keeps the approved piecewise transfer.
// https://www.w3.org/TR/2025/CRD-css-color-4-20250424/#color-conversion-code
const srgb: Matrix = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
];
const fromXyz: Matrix = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
];
const d50 = (v: Triple) =>
  multiply(
    [
      [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
      [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
      [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
    ],
    v,
  );
const polar = ([l, c, h]: Triple): Triple => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
function hsl([h, s, l]: Triple): Triple {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}
function xyz(space: Colour["colorSpace"], v: Triple): Triple {
  switch (space) {
    case "srgb":
      return multiply(srgb, map(v, linear));
    case "srgb-linear":
      return multiply(srgb, v);
    case "hsl":
      return xyz("srgb", hsl(v));
    case "hwb": {
      const [h, w, b] = v;
      if (w + b >= 100) return xyz("srgb", [w / (w + b), w / (w + b), w / (w + b)]);
      return xyz(
        "srgb",
        map(hsl([h, 100, 50]), (n) => n * (1 - (w + b) / 100) + w / 100),
      );
    }
    case "lch":
      return xyz("lab", polar(v));
    case "lab": {
      const [l, a, b] = v;
      const y = l / 116 + 16 / 116;
      const inverse = (f: number) => (f ** 3 > 216 / 24389 ? f ** 3 : (116 * f - 16) / (24389 / 27));
      return d50([
        inverse(y + a / 500) * (0.3457 / 0.3585),
        l > 8 ? ((l + 16) / 116) ** 3 : l / (24389 / 27),
        inverse(y - b / 200) * ((1 - 0.3457 - 0.3585) / 0.3585),
      ]);
    }
    case "oklch":
      return xyz("oklab", polar(v));
    case "oklab":
      return multiply(
        [
          [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
          [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
          [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
        ],
        map(
          multiply(
            [
              [1, 0.3963377773761749, 0.2158037573099136],
              [1, -0.1055613458156586, -0.0638541728258133],
              [1, -0.0894841775298119, -1.2914855480194092],
            ],
            v,
          ),
          (n) => n ** 3,
        ),
      );
    case "display-p3":
      return multiply(
        [
          [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
          [35783 / 156275, 247089 / 357200, 198249 / 2500400],
          [0, 32229 / 714400, 5220557 / 5000800],
        ],
        map(v, linear),
      );
    case "a98-rgb":
      return multiply(
        [
          [573536 / 994567, 263643 / 1420810, 187206 / 994567],
          [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
          [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
        ],
        map(v, (n) => n ** (563 / 256)),
      );
    case "prophoto-rgb":
      return d50(
        multiply(
          [
            [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
            [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
            [0, 0, 0.8251046025104602],
          ],
          map(v, (n) => (n <= 16 / 512 ? n / 16 : n ** 1.8)),
        ),
      );
    case "rec2020":
      return multiply(
        [
          [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314],
          [26158966 / 99577255, 472592308 / 697040785, 8267143 / 139408157],
          [0, 19567812 / 697040785, 295819943 / 278816314],
        ],
        map(v, (n) =>
          n < 0.018053968510807 * 4.5 ? n / 4.5 : ((n + 1.09929682680944 - 1) / 1.09929682680944) ** (1 / 0.45),
        ),
      );
    case "xyz-d50":
      return d50(v);
    case "xyz-d65":
      return v;
  }
}

/** Standalone missing components are zero; hex is fallback metadata. Clip only in linear sRGB. */
export function toSrgb(colour: Colour): Triple {
  const [a, b, c] = colour.components;
  const v: Triple = [a === "none" ? 0 : a, b === "none" ? 0 : b, c === "none" ? 0 : c];
  // Avoid matrix round-trip noise at exact sRGB threshold boundaries.
  if (colour.colorSpace === "srgb") return v;
  if (colour.colorSpace === "hsl") return hsl(v);
  if (colour.colorSpace === "hwb") {
    const [h, w, b] = v;
    return w + b >= 100
      ? [w / (w + b), w / (w + b), w / (w + b)]
      : map(hsl([h, 100, 50]), (n) => n * (1 - (w + b) / 100) + w / 100);
  }
  return map(multiply(fromXyz, xyz(colour.colorSpace, v)), (n) =>
    Number.isFinite(n) ? encoded(Math.min(1, Math.max(0, n))) : NaN,
  );
}
const luminance = (rgb: Triple) => {
  const [r, g, b] = map(rgb, linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrastRatio(foreground: Triple, background: Triple): number {
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const over = (rgb: Triple, alpha: number, base: Triple): Triple => [
  alpha * rgb[0] + (1 - alpha) * base[0],
  alpha * rgb[1] + (1 - alpha) * base[1],
  alpha * rgb[2] + (1 - alpha) * base[2],
];

/** Only called after structural validation, with an installed vocabulary. No render-time work. */
export function checkContrast(
  theme: Theme,
  vocabulary: Vocabulary,
  reject: (pointer: string, message: string, kind?: LiveframeError["kind"]) => void,
): void {
  const baseRole = vocabulary.contrastBase;
  const base = baseRole === undefined ? undefined : theme.colours[baseRole];
  if (base && (base.alpha ?? 1) !== 1) {
    reject(`/colours/${baseRole}/alpha`, "contrastBase must be opaque");
    return;
  }
  const cache = new Map<string, Triple>();
  const colour = (role: string) => {
    let rgb = cache.get(role);
    if (!rgb) {
      rgb = toSrgb(theme.colours[role]!);
      cache.set(role, rgb);
    }
    return rgb;
  };
  const pairs = vocabulary.contrast ?? [];
  const ratios = pairs.map((pair, i) => {
    const background = theme.colours[pair.background]!;
    const alpha = background.alpha ?? 1;
    if (alpha < 1 && !base) {
      reject(
        `/colours/${pair.background}/alpha`,
        `Contrast pair ${i} (${pair.foreground} on ${pair.background}) requires an opaque contrastBase`,
      );
      return NaN;
    }
    const bg = alpha < 1 ? over(colour(pair.background), alpha, colour(baseRole!)) : colour(pair.background);
    const fg = over(colour(pair.foreground), theme.colours[pair.foreground]!.alpha ?? 1, bg);
    const ratio = contrastRatio(fg, bg);
    if (!Number.isFinite(ratio))
      reject(`/colours/${pair.foreground}`, `Contrast pair ${i} cannot be converted to finite sRGB`);
    return ratio;
  });
  const label = (i: number) => `${i} (${pairs[i]!.foreground} on ${pairs[i]!.background}): ${ratios[i]!.toFixed(2)}`;
  for (const [i, pair] of pairs.entries()) {
    const ratio = ratios[i]!;
    if (ratio < pair.minimum || (pair.maximum !== undefined && ratio > pair.maximum))
      reject(
        `/colours/${pair.foreground}`,
        `Contrast pair ${label(i)}; expected ${pair.minimum}–${pair.maximum ?? 21}`,
        "insufficient-contrast",
      );
    if (pair.lessThan !== undefined && ratio >= ratios[pair.lessThan]!)
      reject(
        `/colours/${pair.foreground}`,
        `Contrast pair ${label(i)} must be less than pair ${label(pair.lessThan)}`,
        "insufficient-contrast",
      );
  }
}
