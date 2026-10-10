// Team banner artwork: preset gradients, accent swatches, and a client-side
// downscale for uploaded images. localStorage is only ~5 MB, so an upload is
// cropped to the banner aspect and re-encoded as JPEG before it is stored —
// the raw file never gets near the browser's storage quota.

export interface BannerPreset { id: string; label: string; css: string }

export const BANNER_PRESETS: BannerPreset[] = [
  { id: "pitch", label: "Pitch", css: "linear-gradient(120deg, #1f6b4a, #0d3b28 72%)" },
  { id: "sunset", label: "Sunset", css: "linear-gradient(120deg, #ef653d, #6d1c08 78%)" },
  { id: "midnight", label: "Midnight", css: "linear-gradient(120deg, #14213d, #040814 78%)" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(120deg, #0e7490, #052e3a 78%)" },
  { id: "plum", label: "Plum", css: "linear-gradient(120deg, #7c3aed, #2a1063 78%)" },
  { id: "acid", label: "Acid", css: "linear-gradient(120deg, #c8ef70, #4a7a1c 82%)" },
];

export const DEFAULT_PRESET = BANNER_PRESETS[0].id;

export const presetCss = (id: string) =>
  BANNER_PRESETS.find((p) => p.id === id)?.css ?? BANNER_PRESETS[0].css;

/** Suggested accent colours that stay legible on the paper workspace. */
export const ACCENTS = ["#c8ef70", "#ef653d", "#1f6b4a", "#14213d", "#0e7490", "#7c3aed", "#be185d", "#a16207"];

/** Ink or paper for text sitting on top of an accent colour. */
export function readableOn(hex: string): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return "#17231f";
  const [r, g, b] = [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? "#17231f" : "#ffffff";
}

/** "Ironwood" -> "IR", "Night Owls" -> "NO", "Iron City FC" -> "ICF". */
export function monogramOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

const BANNER_W = 1600;
const BANNER_H = 500;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/**
 * Scales the image to cover 1600×500, crops the overflow from the centre, and
 * re-encodes it as JPEG so it fits comfortably in localStorage.
 */
function toBannerDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("That file does not look like a usable image. Try a JPG or PNG."));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = BANNER_W;
      canvas.height = BANNER_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Image editing is unavailable in this browser."));
      const scale = Math.max(BANNER_W / img.naturalWidth, BANNER_H / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (BANNER_W - w) / 2, (BANNER_H - h) / 2, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = src;
  });
}

/** Turns a picked file into a stored banner, or throws a message worth showing. */
export async function bannerFromFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");
  const raw = await readFileAsDataUrl(file);
  return toBannerDataUrl(raw);
}
