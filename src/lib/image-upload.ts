export type UploadDocType =
  | "profile_photo"
  | "aadhar_front"
  | "aadhar_back"
  | "alternate_id";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image file."));
    };
    img.src = objectUrl;
  });
}

function drawToCanvas(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not prepare image canvas.");
  }

  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function detectDocumentBounds(canvas: HTMLCanvasElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height).data;
  const threshold = 242;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      const a = imageData[index + 3];
      const isBackgroundLike =
        a < 10 || (r > threshold && g > threshold && b > threshold);

      if (!isBackgroundLike) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width, height };
  }

  const padX = Math.round(width * 0.03);
  const padY = Math.round(height * 0.03);

  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  const cropWidth = Math.min(width - x, maxX - minX + 1 + padX * 2);
  const cropHeight = Math.min(height - y, maxY - minY + 1 + padY * 2);

  return { x, y, width: cropWidth, height: cropHeight };
}

function cropCanvas(
  canvas: HTMLCanvasElement,
  bounds: { x: number; y: number; width: number; height: number },
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(bounds.width));
  out.height = Math.max(1, Math.round(bounds.height));
  const ctx = out.getContext("2d");
  if (!ctx) {
    throw new Error("Could not crop image.");
  }
  ctx.drawImage(
    canvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    out.width,
    out.height,
  );
  return out;
}

function cropSquareCenter(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const side = Math.min(canvas.width, canvas.height);
  const x = Math.floor((canvas.width - side) / 2);
  const y = Math.floor((canvas.height - side) / 2);
  return cropCanvas(canvas, { x, y, width: side, height: side });
}

async function toJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function processImageForUpload(
  file: File,
  docType: UploadDocType,
): Promise<File> {
  const source = await loadImage(file);
  const baseCanvas = drawToCanvas(source, docType === "profile_photo" ? 1200 : 1600);

  const cropped =
    docType === "profile_photo"
      ? cropSquareCenter(baseCanvas)
      : cropCanvas(baseCanvas, detectDocumentBounds(baseCanvas));

  let quality = 0.9;
  let blob = await toJpegBlob(cropped, quality);
  const maxBytes = 600 * 1024;

  while (blob.size > maxBytes && quality > 0.5) {
    quality -= 0.1;
    blob = await toJpegBlob(cropped, quality);
  }

  const safeName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-");
  return new File([blob], `${safeName || "upload"}.jpg`, { type: "image/jpeg" });
}
