/**
 * File → data URL, downscaled first.
 *
 * Images are stored inline (base64) inside notes and covers, and the whole
 * note is re-sent on every autosave. Raw tablet/phone photos are several MB,
 * which blows past hosting request-body limits and slow mobile uplinks, so
 * the save fails with "Sunucuya ulaşılamadı". Anything larger than
 * `maxDim` px or `keepBelowBytes` is redrawn smaller as JPEG.
 */
const PASSTHROUGH = /^image\/(svg\+xml|gif)$/;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read"));
    reader.readAsDataURL(blob);
  });
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function imageFileToDataUrl(
  file: File,
  { maxDim = 1600, quality = 0.82, keepBelowBytes = 250_000 } = {},
): Promise<string> {
  if (PASSTHROUGH.test(file.type)) return readAsDataUrl(file);
  try {
    const img = await decode(file);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale === 1 && file.size <= keepBelowBytes) {
      img.close();
      return readAsDataUrl(file);
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      img.close();
      return readAsDataUrl(file);
    }
    ctx.fillStyle = "#fff"; // JPEG has no alpha
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
    img.close();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // Undecodable here (e.g. HEIC on some browsers): keep the original.
    return readAsDataUrl(file);
  }
}
