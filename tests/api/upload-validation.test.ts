// @vitest-environment node

import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AnalysisFailure } from "@/lib/analyze/errors";
import type { UploadConfig } from "@/lib/upload/config";
import {
  validateImageUpload,
  type UploadFile,
} from "@/lib/upload/validate-image";

const config: UploadConfig = {
  maxBytes: 1024 * 1024,
  maxEdgePixels: 10_000,
  maxPixels: 40_000_000,
};

const formats = [
  { extension: "png", mimeType: "image/png" },
  { extension: "jpg", mimeType: "image/jpeg" },
  { extension: "webp", mimeType: "image/webp" },
] as const;

const encodedImages = new Map<string, Buffer>();

function arrayBufferFrom(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function uploadFile(
  bytes: Buffer,
  name: string,
  type: string,
  read = vi.fn(async () => arrayBufferFrom(bytes)),
): UploadFile {
  return { arrayBuffer: read, name, size: bytes.byteLength, type };
}

async function expectFailure(
  promise: Promise<unknown>,
  code: AnalysisFailure["code"],
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

beforeAll(async () => {
  for (const format of formats) {
    const pipeline = sharp({
      create: {
        background: { b: 220, g: 230, r: 240 },
        channels: 3,
        height: 24,
        width: 32,
      },
    });
    const bytes = await (format.extension === "jpg"
      ? pipeline.jpeg()
      : format.extension === "webp"
        ? pipeline.webp()
        : pipeline.png()
    ).toBuffer();
    encodedImages.set(format.mimeType, bytes);
  }
});

describe("validateImageUpload", () => {
  it.each(formats)("accepts a decoded $mimeType image", async (format) => {
    const bytes = encodedImages.get(format.mimeType);
    expect(bytes).toBeDefined();

    const validated = await validateImageUpload(
      uploadFile(bytes!, `lesson.${format.extension}`, format.mimeType),
      config,
    );

    expect(validated).toMatchObject({
      height: 24,
      mimeType: format.mimeType,
      width: 32,
    });
  });

  it("rejects unsupported MIME, extension mismatch, and magic-byte mismatch", async () => {
    const png = encodedImages.get("image/png")!;

    await expectFailure(
      validateImageUpload(uploadFile(png, "lesson.png", "image/gif"), config),
      "UNSUPPORTED_FILE_TYPE",
    );
    await expectFailure(
      validateImageUpload(uploadFile(png, "lesson.jpg", "image/png"), config),
      "UNSUPPORTED_FILE_TYPE",
    );
    await expectFailure(
      validateImageUpload(uploadFile(png, "lesson.png", "image/jpeg"), config),
      "UNSUPPORTED_FILE_TYPE",
    );
  });

  it("rejects bytes above the configured limit before reading them", async () => {
    const read = vi.fn(async () => new ArrayBuffer(0));
    const file: UploadFile = {
      arrayBuffer: read,
      name: "large.png",
      size: config.maxBytes + 1,
      type: "image/png",
    };

    await expectFailure(validateImageUpload(file, config), "FILE_TOO_LARGE");
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects malformed image data and decoded dimensions outside the bounds", async () => {
    const truncatedPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    await expectFailure(
      validateImageUpload(
        uploadFile(truncatedPng, "broken.png", "image/png"),
        config,
      ),
      "INVALID_IMAGE",
    );

    const png = encodedImages.get("image/png")!;
    await expectFailure(
      validateImageUpload(uploadFile(png, "wide.png", "image/png"), {
        ...config,
        maxEdgePixels: 16,
      }),
      "INVALID_IMAGE",
    );
  });
});
