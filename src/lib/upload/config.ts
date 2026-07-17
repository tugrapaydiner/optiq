export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_EDGE_PIXELS = 10_000;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const PROVIDER_OUTPUT_MAX_BYTES = 256 * 1024;
export const PROVIDER_TIMEOUT_MS = 60_000;

export type UploadConfig = {
  maxBytes: number;
  maxEdgePixels: number;
  maxPixels: number;
};

function configuredMaxBytes(): number {
  const rawValue = process.env.OPTIQ_MAX_UPLOAD_BYTES;
  if (!rawValue) return DEFAULT_MAX_UPLOAD_BYTES;

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 1024 || value > DEFAULT_MAX_UPLOAD_BYTES) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }
  return value;
}

export function getUploadConfig(): UploadConfig {
  return {
    maxBytes: configuredMaxBytes(),
    maxEdgePixels: MAX_IMAGE_EDGE_PIXELS,
    maxPixels: MAX_IMAGE_PIXELS,
  };
}

export function formatUploadLimit(maxBytes: number): string {
  if (maxBytes < 1024 * 1024) {
    const kilobytes = maxBytes / 1024;
    const formattedKilobytes = Number.isInteger(kilobytes)
      ? String(kilobytes)
      : kilobytes.toFixed(1).replace(/\.0$/, "");
    return `${formattedKilobytes} KB`;
  }
  const megabytes = maxBytes / (1024 * 1024);
  const formatted = Number.isInteger(megabytes)
    ? String(megabytes)
    : megabytes.toFixed(1).replace(/\.0$/, "");
  return `${formatted} MB`;
}
