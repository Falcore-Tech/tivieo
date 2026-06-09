import { readFile, writeFile } from "node:fs/promises";

const oklchToSrgb = (L: number, C: number, hDeg: number) => {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const gamma = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

  return [gamma(lr), gamma(lg), gamma(lb)].map((c) =>
    Math.min(1, Math.max(0, c)),
  ) as [number, number, number];
};

const srgbToHsl = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return [h, s * 100, l * 100] as [number, number, number];
};

const round = (n: number, p = 1) => {
  const f = 10 ** p;
  return Math.round(n * f) / f;
};

const oklchToHslString = (L: number, C: number, h: number) => {
  const [r, g, b] = oklchToSrgb(L, C, h);
  const [hh, ss, ll] = srgbToHsl(r, g, b);
  return `hsl(${round(hh)} ${round(ss)}% ${round(ll)}%)`;
};

const path = process.argv[2];
if (!path) throw new Error("usage: oklch-to-hsl.ts <file>");

const source = await readFile(path, "utf8");
const converted = source.replace(
  /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g,
  (_match: string, l: string, c: string, h: string) =>
    oklchToHslString(Number(l), Number(c), Number(h)),
);

await writeFile(path, converted);
console.log("converted oklch → hsl in", path);
