// A photo chosen while editing is made small before it is sent: at most
// 1280 pixels on its longest side (the boards are drawn 768 wide, the book's
// polaroid smaller), turned the way the camera held it, and saved as WebP,
// or as JPEG where a browser can't make WebP (older iPhones). AVIF would be
// a little smaller, but no browser can make it and converting on the free
// Render server would be slow, so WebP it is.

export const PHOTO_MAX = 1280;
export const PHOTO_MAX_INPUT = 30 * 1024 * 1024; // bigger files are refused before reading
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.86;

// The size a photo is shrunk to (never enlarged).
export function fitSize(width, height, max = PHOTO_MAX) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// The width and height a stored photo's name carries ("…-1280x960.webp").
export function photoSize(url) {
  const match = /-(\d+)x(\d+)\.(?:webp|jpg)$/.exec(String(url || ""));
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Some browsers can't take the options, or the file: try an <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

export async function compressPhoto(file, { max = PHOTO_MAX, doc = document } = {}) {
  const source = await decode(file);
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  const { width, height } = fitSize(sourceWidth, sourceHeight, max);
  // Halve in steps first, so a big photo shrinks smoothly (no jagged edges).
  const canvas = doc.createElement("canvas");
  let w = sourceWidth;
  let h = sourceHeight;
  let from = source;
  while (w / 2 > width && h / 2 > height) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    const step = doc.createElement("canvas");
    step.width = w;
    step.height = h;
    step.getContext("2d").drawImage(from, 0, 0, w, h);
    from = step;
  }
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.fillStyle = "#ffffff"; // see-through parts become white, not black
  g.fillRect(0, 0, width, height);
  g.drawImage(from, 0, 0, width, height);
  source.close?.();
  let blob = await toBlob(canvas, "image/webp", WEBP_QUALITY);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
  if (!blob) throw new Error("The photo could not be saved.");
  return { blob, width, height };
}
