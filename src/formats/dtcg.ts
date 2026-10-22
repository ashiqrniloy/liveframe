import { arr, bool, type Infer, num, obj, str } from "../schema.ts";

export const colourFields = obj(
  {
    colorSpace: str({
      maxLength: 16,
      enum: [
        "srgb",
        "srgb-linear",
        "hsl",
        "hwb",
        "lab",
        "lch",
        "oklab",
        "oklch",
        "display-p3",
        "a98-rgb",
        "prophoto-rgb",
        "rec2020",
        "xyz-d65",
        "xyz-d50",
      ],
    }),
    components: bool(),
  },
  { alpha: num({ minimum: 0, maximum: 1 }), hex: str({ maxLength: 7, pattern: "^#[0-9a-fA-F]{6}$" }) },
);
export type Colour = Omit<Infer<typeof colourFields>, "components"> & {
  readonly components: readonly [number | "none", number | "none", number | "none"];
};

export const dimension = obj({
  value: num({ minimum: 0, maximum: 4096 }),
  unit: str({ maxLength: 3, enum: ["px", "rem"] }),
});
const letterSpacing = obj({
  value: num({ minimum: -1024, maximum: 1024 }),
  unit: str({ maxLength: 3, enum: ["px", "rem", "em"] }),
});
export const fontName = str({
  maxLength: 128,
  pattern: "^(?!.*[uU][rR][lL]\\s*\\()[^;{}\\\\\\u0000-\\u001f\\u007f]+$",
});
export const fontList = arr(fontName, { maxItems: 8 });
export const fontWeightNumber = num({ minimum: 1, maximum: 1000 });
export const fontWeightAlias = str({
  maxLength: 11,
  enum: [
    "thin",
    "hairline",
    "extra-light",
    "ultra-light",
    "light",
    "normal",
    "regular",
    "book",
    "medium",
    "semi-bold",
    "demi-bold",
    "bold",
    "extra-bold",
    "ultra-bold",
    "black",
    "heavy",
    "extra-black",
    "ultra-black",
  ],
});
export const typographyFields = obj(
  { fontFamily: bool(), fontSize: dimension, fontWeight: bool(), lineHeight: num({ minimum: 0, maximum: 10 }) },
  {
    letterSpacing,
    textTransform: str({ maxLength: 9, enum: ["none", "uppercase"] }),
    fontStretch: num({ minimum: 50, maximum: 200 }),
    fontSizeAdjust: num({ minimum: 0, maximum: 10 }),
  },
);
export type Typography = Omit<Infer<typeof typographyFields>, "fontFamily" | "fontWeight"> & {
  readonly fontFamily: string | readonly string[];
  readonly fontWeight: number | Infer<typeof fontWeightAlias>;
};
export const typographySchema = {
  ...typographyFields,
  properties: {
    ...typographyFields.properties,
    fontFamily: { oneOf: [fontName, { ...fontList, minItems: 1 }] },
    fontWeight: { oneOf: [fontWeightNumber, fontWeightAlias] },
  },
};
