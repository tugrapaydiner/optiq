import sharp from "sharp";

import { AnalysisFailure } from "../analyze/errors";
import type { UploadConfig } from "./config";
import {
  SUPPORTED_IMAGE_MIME_TYPES,
  type SupportedImageMimeType,
} from "./shared";

export type { SupportedImageMimeType } from "./shared";

export type UploadFile = {
  arrayBuffer(): Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
};

export type ValidatedImage = {
  bytes: Buffer;
  height: number;
  mimeType: SupportedImageMimeType;
  width: number;
};

function isSupportedMime(value: string): value is SupportedImageMimeType {
  return SUPPORTED_IMAGE_MIME_TYPES.some((mimeType) => mimeType === value);
}

function mimeFromMagic(bytes: Buffer): SupportedImageMimeType | null {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function mimeFromExtension(filename: string): SupportedImageMimeType | null {
  const extension = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return null;
}

export function isUploadFile(value: unknown): value is UploadFile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<UploadFile>;
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.type === "string"
  );
}

export async function validateImageUpload(
  file: UploadFile,
  config: UploadConfig,
): Promise<ValidatedImage> {
  if (file.size < 1) throw new AnalysisFailure("INVALID_IMAGE");
  if (file.size > config.maxBytes) throw new AnalysisFailure("FILE_TOO_LARGE");
  if (!isSupportedMime(file.type)) {
    throw new AnalysisFailure("UNSUPPORTED_FILE_TYPE");
  }

  const extensionMime = mimeFromExtension(file.name);
  if (extensionMime === null || extensionMime !== file.type) {
    throw new AnalysisFailure("UNSUPPORTED_FILE_TYPE");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength !== file.size) throw new AnalysisFailure("INVALID_IMAGE");

  const magicMime = mimeFromMagic(bytes);
  if (magicMime === null || magicMime !== file.type) {
    throw new AnalysisFailure("UNSUPPORTED_FILE_TYPE");
  }

  try {
    const image = sharp(bytes, {
      failOn: "error",
      limitInputPixels: config.maxPixels,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    const width = metadata.width;
    const height = metadata.height;

    if (
      width === undefined ||
      height === undefined ||
      width < 1 ||
      height < 1 ||
      width > config.maxEdgePixels ||
      height > config.maxEdgePixels ||
      width * height > config.maxPixels
    ) {
      throw new AnalysisFailure("INVALID_IMAGE");
    }

    await image.stats();
    return { bytes, height, mimeType: magicMime, width };
  } catch (error) {
    if (error instanceof AnalysisFailure) throw error;
    throw new AnalysisFailure("INVALID_IMAGE");
  }
}
