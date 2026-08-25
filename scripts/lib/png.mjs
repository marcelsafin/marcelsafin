import { PNG } from "pngjs";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export function validatePng(buffer, {
  width,
  height,
  transparency,
}) {
  if (!Buffer.isBuffer(buffer) || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new TypeError("asset must begin with a valid PNG signature");
  }
  if (!Number.isSafeInteger(width) || width <= 0 ||
      !Number.isSafeInteger(height) || height <= 0) {
    throw new TypeError("PNG contract dimensions must be positive integers");
  }
  if (transparency !== "required" && transparency !== "forbidden") {
    throw new TypeError(
      'PNG transparency must be "required" or "forbidden"',
    );
  }

  let png;
  try {
    png = PNG.sync.read(buffer);
  } catch (error) {
    throw new TypeError(`asset must be a decodable PNG: ${error.message}`, {
      cause: error,
    });
  }

  if (png.width !== width || png.height !== height) {
    throw new TypeError(
      `PNG must be exactly ${width}x${height}; received ${png.width}x${png.height}`,
    );
  }

  let hasTransparency = false;
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] < 255) {
      hasTransparency = true;
      break;
    }
  }

  if (transparency === "required" && !hasTransparency) {
    throw new TypeError("PNG must contain at least one transparent pixel");
  }
  if (transparency === "forbidden" && hasTransparency) {
    throw new TypeError("PNG must be opaque");
  }

  return {
    width: png.width,
    height: png.height,
    hasTransparency,
  };
}
