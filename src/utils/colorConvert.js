/**
 * تحويلات الألوان للمحول (HEX, RGB, LAB) وحساب Delta E 76
 */

function hexToRgb(hex) {
  hex = String(hex).replace(/^#/, "").trim();
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length !== 6) return null;
  const n = parseInt(hex, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  const toHex = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function srgbToLinear(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r, g, b) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  const z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;
  return { x: x * 100, y: y * 100, z: z * 100 };
}

function xyzToLab(x, y, z) {
  const ref = { x: 95.047, y: 100, z: 108.883 };
  const f = (t) => (t > 0.008856 ? Math.pow(t, 1 / 3) : t / 7.787 + 16 / 116);
  const fx = f(x / ref.x), fy = f(y / ref.y), fz = f(z / ref.z);
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function rgbToLab(r, g, b) {
  const { x, y, z } = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

export function hexToLab(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToLab(rgb.r, rgb.g, rgb.b);
}

/** Delta E 76: المسافة الإقليدية في LAB */
export function deltaE76(lab1, lab2) {
  const L = (lab1.l - lab2.l) ** 2;
  const A = (lab1.a - lab2.a) ** 2;
  const B = (lab1.b - lab2.b) ** 2;
  return Math.sqrt(L + A + B);
}

/** تحويل RGB 0-255 إلى قيم CMYK تقريبية (نسبة 0-100) */
export function rgbToCmyk(r, g, b) {
  let c = 1 - r / 255, m = 1 - g / 255, y = 1 - b / 255, k = Math.min(c, m, y);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  c = ((c - k) / (1 - k)) * 100;
  m = ((m - k) / (1 - k)) * 100;
  y = ((y - k) / (1 - k)) * 100;
  k = k * 100;
  return { c, m, y, k };
}

/** تحويل RGB إلى HSL (h 0-360, s/l 0-100) */
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** من HEX إرجاع كائن كامل للمصدر: hex, rgb, cmyk, hsl, lab */
export function hexToAllFormats(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const normalizedHex = rgbToHex(rgb.r, rgb.g, rgb.b);
  return {
    hex: normalizedHex,
    rgb: { r: rgb.r, g: rgb.g, b: rgb.b },
    cmyk: { c: cmyk.c, m: cmyk.m, y: cmyk.y, k: cmyk.k },
    hsl: { h: hsl.h, s: hsl.s, l: hsl.l },
    lab: { l: lab.l, a: lab.a, b: lab.b },
  };
}

export { hexToRgb, rgbToHex };
