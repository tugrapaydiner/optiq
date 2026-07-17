// @vitest-environment node

import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AnalysisFailure } from "@/lib/analyze/errors";
import { createAnalyzeHandler } from "@/lib/analyze/handler";
import type {
  AnalysisProvider,
  ProviderExtractionResult,
} from "@/lib/analyze/provider";
import type { AnalyzeEnvelope, AnalyzeMode } from "@/lib/analyze/types";
import {
  createOpenAIProvider,
  type OpenAIResponsesClient,
} from "@/lib/openai/provider";
import type { UploadConfig } from "@/lib/upload/config";
import {
  makeChartLesson,
  makeProcessLesson,
  makeUnsupportedChartLesson,
} from "../contracts/test-lessons";

const firstSafetyIdentifier = `anon_${"A".repeat(22)}`;
const secondSafetyIdentifier = `anon_${"B".repeat(22)}`;
const uploadConfig: UploadConfig = {
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

beforeAll(async () => {
  for (const format of formats) {
    const pipeline = sharp({
      create: {
        background: { b: 245, g: 240, r: 235 },
        channels: 3,
        height: 18,
        width: 24,
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

function providerWithOutput(
  output: unknown,
  kind: AnalysisProvider["kind"] = "openai",
) {
  const extract = vi.fn<AnalysisProvider["extract"]>(async (input) => {
    void input;
    return {
      outputText:
        typeof output === "string" ? output : JSON.stringify(output),
      providerRequestId: "provider_req_1",
    };
  });
  return { extract, provider: { extract, kind } satisfies AnalysisProvider };
}

function imageRequest({
  bytes = encodedImages.get("image/png")!,
  cookie,
  extraFields,
  filename = "owned-chart.png",
  mimeType = "image/png",
  mode = "chart",
}: {
  bytes?: Buffer;
  cookie?: string;
  extraFields?: Record<string, string>;
  filename?: string;
  mimeType?: string;
  mode?: AnalyzeMode | string | null;
} = {}): Request {
  const formData = new FormData();
  if (mode !== null) formData.set("mode", mode);
  formData.set(
    "file",
    new File([Uint8Array.from(bytes)], filename, { type: mimeType }),
  );
  for (const [key, value] of Object.entries(extraFields ?? {})) {
    formData.set(key, value);
  }
  const headers = new Headers({
    "user-agent": "private-user-agent-value",
    "x-forwarded-for": "203.0.113.50",
  });
  if (cookie) headers.set("cookie", cookie);
  return new Request("http://optiq.test/api/analyze", {
    body: formData,
    headers,
    method: "POST",
  });
}

async function envelope(response: Response): Promise<AnalyzeEnvelope> {
  return (await response.json()) as AnalyzeEnvelope;
}

describe("POST /api/analyze handler", () => {
  it.each(formats)("lets a valid $mimeType upload reach the provider", async (format) => {
    const { extract, provider } = providerWithOutput(makeChartLesson());
    const handler = createAnalyzeHandler({
      generateSafetyIdentifier: () => firstSafetyIdentifier,
      logger: vi.fn(),
      providerFactory: () => provider,
      uploadConfig,
    });
    const bytes = encodedImages.get(format.mimeType);
    expect(bytes).toBeDefined();

    const response = await handler(
      imageRequest({
        bytes,
        filename: `owned-chart.${format.extension}`,
        mimeType: format.mimeType,
      }),
    );

    expect(response.status).toBe(200);
    expect(extract).toHaveBeenCalledOnce();
    expect(extract.mock.calls[0]?.[0].image.mimeType).toBe(format.mimeType);
  });

  it("rejects a missing mode or file", async () => {
    const { extract, provider } = providerWithOutput(makeChartLesson());
    const handler = createAnalyzeHandler({
      generateSafetyIdentifier: () => firstSafetyIdentifier,
      logger: vi.fn(),
      providerFactory: () => provider,
      uploadConfig,
    });

    const missingMode = await handler(imageRequest({ mode: null }));
    expect(missingMode.status).toBe(400);
    expect(await envelope(missingMode)).toMatchObject({
      error: { code: "INVALID_REQUEST" },
      ok: false,
    });

    const formData = new FormData();
    formData.set("mode", "chart");
    const missingFile = await handler(
      new Request("http://optiq.test/api/analyze", {
        body: formData,
        method: "POST",
      }),
    );
    expect(missingFile.status).toBe(400);
    expect(extract).not.toHaveBeenCalled();
  });

  it("rejects oversized bytes before provider and reports the same configured limit", async () => {
    const { extract, provider } = providerWithOutput(makeChartLesson());
    const handler = createAnalyzeHandler({
      generateSafetyIdentifier: () => firstSafetyIdentifier,
      logger: vi.fn(),
      providerFactory: () => provider,
      uploadConfig,
    });

    const response = await handler(
      imageRequest({ bytes: Buffer.alloc(uploadConfig.maxBytes + 1) }),
    );
    const body = await envelope(response);

    expect(response.status).toBe(413);
    expect(body).toMatchObject({
      error: {
        code: "FILE_TOO_LARGE",
        message: expect.stringContaining("1 MB limit"),
      },
      ok: false,
    });
    expect(extract).not.toHaveBeenCalled();
  });

  it("rejects MIME, extension, magic-byte, and decode failures before provider", async () => {
    const { extract, provider } = providerWithOutput(makeChartLesson());
    const handler = createAnalyzeHandler({
      generateSafetyIdentifier: () => firstSafetyIdentifier,
      logger: vi.fn(),
      providerFactory: () => provider,
      uploadConfig,
    });

    for (const request of [
      imageRequest({ filename: "chart.gif", mimeType: "image/gif" }),
      imageRequest({ filename: "chart.jpg", mimeType: "image/png" }),
      imageRequest({
        bytes: encodedImages.get("image/png"),
        filename: "chart.jpg",
        mimeType: "image/jpeg",
      }),
      imageRequest({
        bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
      }),
    ]) {
      const response = await handler(request);
      expect([415, 422]).toContain(response.status);
      expect((await envelope(response)).ok).toBe(false);
    }
    expect(extract).not.toHaveBeenCalled();
  });

  it("creates, reuses, and isolates opaque session identifiers", async () => {
    const { extract, provider } = providerWithOutput(makeChartLesson());
    const generate = vi
      .fn<() => string>()
      .mockReturnValueOnce(firstSafetyIdentifier)
      .mockReturnValueOnce(secondSafetyIdentifier);
    const logger = vi.fn();
    const handler = createAnalyzeHandler({
      generateSafetyIdentifier: generate,
      logger,
      providerFactory: () => provider,
      secureCookies: true,
      uploadConfig,
    });

    const first = await handler(
      imageRequest({
        extraFields: { safety_identifier: "email@example.com" },
        filename: "student@example.com.png",
      }),
    );
    const firstCookie = first.headers.get("set-cookie");
    expect(firstCookie).toContain(`optiq_sid=${firstSafetyIdentifier}`);
    expect(firstCookie).toContain("HttpOnly");
    expect(firstCookie).toContain("SameSite=Lax");
    expect(firstCookie).toContain("Path=/");
    expect(firstCookie).toContain("Secure");
    expect(extract.mock.calls[0]?.[0].safetyIdentifier).toBe(
      firstSafetyIdentifier,
    );

    const reused = await handler(
      imageRequest({ cookie: `optiq_sid=${firstSafetyIdentifier}` }),
    );
    expect(reused.headers.get("set-cookie")).toBeNull();
    expect(extract.mock.calls[1]?.[0].safetyIdentifier).toBe(
      firstSafetyIdentifier,
    );

    await handler(imageRequest());
    expect(extract.mock.calls[2]?.[0].safetyIdentifier).toBe(
      secondSafetyIdentifier,
    );
    expect(firstSafetyIdentifier).not.toBe(secondSafetyIdentifier);

    const publicAndLogText = JSON.stringify([
      await envelope(first),
      logger.mock.calls,
    ]);
    expect(publicAndLogText).not.toContain(firstSafetyIdentifier);
    expect(publicAndLogText).not.toContain("student@example.com");
    expect(publicAndLogText).not.toContain("203.0.113.50");
    expect(publicAndLogText).not.toContain("private-user-agent-value");
  });

  it("passes the newly created cookie identifier into the mocked Responses SDK", async () => {
    const create = vi.fn().mockResolvedValue({
      error: null,
      id: "resp_cookie_test",
      output_text: JSON.stringify(makeChartLesson()),
      status: "completed",
    });
    const client = {
      create: create as OpenAIResponsesClient["create"],
    };
    const handler = createAnalyzeHandler({
      generateSafetyIdentifier: () => firstSafetyIdentifier,
      logger: vi.fn(),
      providerFactory: () => createOpenAIProvider(client),
      uploadConfig,
    });

    const response = await handler(imageRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      `optiq_sid=${firstSafetyIdentifier}`,
    );
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      safety_identifier: firstSafetyIdentifier,
    });
  });

  it("replaces a malformed cookie rather than forwarding it", async () => {
    const { extract, provider } = providerWithOutput(makeChartLesson());
    const handler = createAnalyzeHandler({
      generateSafetyIdentifier: () => firstSafetyIdentifier,
      logger: vi.fn(),
      providerFactory: () => provider,
      uploadConfig,
    });

    const response = await handler(
      imageRequest({ cookie: "optiq_sid=client-controlled-value" }),
    );
    expect(response.headers.get("set-cookie")).toContain(firstSafetyIdentifier);
    expect(extract.mock.calls[0]?.[0].safetyIdentifier).toBe(
      firstSafetyIdentifier,
    );
  });

  it("validates successful chart and process output before returning it", async () => {
    for (const [mode, lesson] of [
      ["chart", makeChartLesson()],
      ["process", makeProcessLesson()],
    ] as const) {
      const { provider } = providerWithOutput(lesson, "fixture");
      const handler = createAnalyzeHandler({
        generateSafetyIdentifier: () => firstSafetyIdentifier,
        logger: vi.fn(),
        providerFactory: () => provider,
        uploadConfig,
      });
      const response = await handler(imageRequest({ mode }));

      expect(response.status).toBe(200);
      expect(await envelope(response)).toMatchObject({
        lesson: { schemaVersion: "1.0", supported: true },
        mode,
        ok: true,
        provider: "fixture",
      });
    }
  });

  it.each([
    ["malformed JSON", "{not-json"],
    ["extra property", { ...makeChartLesson(), unexpected: "no" }],
    [
      "semantic invalid lesson",
      {
        ...makeChartLesson(),
        series: [
          {
            ...makeChartLesson().series[0],
            points: [
              makeChartLesson().series[0]!.points[0],
              makeChartLesson().series[0]!.points[0],
            ],
          },
        ],
      },
    ],
  ])("fails safely for %s provider output", async (_label, output) => {
    const { provider } = providerWithOutput(output);
    const handler = createAnalyzeHandler({
      generateSafetyIdentifier: () => firstSafetyIdentifier,
      logger: vi.fn(),
      providerFactory: () => provider,
      uploadConfig,
    });

    const response = await handler(imageRequest());
    expect(response.status).toBe(502);
    expect(await envelope(response)).toMatchObject({
      error: { code: "INVALID_MODEL_OUTPUT" },
      ok: false,
    });
  });

  it("returns the honest unsupported state rather than a plausible lesson", async () => {
    const { provider } = providerWithOutput(makeUnsupportedChartLesson());
    const handler = createAnalyzeHandler({
      generateSafetyIdentifier: () => firstSafetyIdentifier,
      logger: vi.fn(),
      providerFactory: () => provider,
      uploadConfig,
    });

    const response = await handler(imageRequest());
    expect(response.status).toBe(422);
    expect(await envelope(response)).toMatchObject({
      error: { code: "UNSUPPORTED_VISUAL", retryable: false },
      ok: false,
    });
  });

  it("sanitizes provider failures and maps an aborted provider to timeout", async () => {
    const rawProvider: AnalysisProvider = {
      extract: vi.fn(async () => {
        throw new Error("raw provider key sk-do-not-return");
      }),
      kind: "openai",
    };
    const handler = createAnalyzeHandler({
      generateSafetyIdentifier: () => firstSafetyIdentifier,
      logger: vi.fn(),
      providerFactory: () => rawProvider,
      uploadConfig,
    });
    const rawResponse = await handler(imageRequest());
    const rawBodyText = await rawResponse.text();
    expect(rawResponse.status).toBe(500);
    expect(rawBodyText).not.toContain("sk-do-not-return");
    expect(rawBodyText).not.toContain("raw provider");

    const timeoutProvider: AnalysisProvider = {
      extract: vi.fn(
        (input) =>
          new Promise<ProviderExtractionResult>((_resolve, reject) => {
            input.signal.addEventListener(
              "abort",
              () => reject(new DOMException("private timeout", "AbortError")),
              { once: true },
            );
          }),
      ),
      kind: "openai",
    };
    const timeoutHandler = createAnalyzeHandler({
      generateSafetyIdentifier: () => firstSafetyIdentifier,
      logger: vi.fn(),
      providerFactory: () => timeoutProvider,
      timeoutMs: 5,
      uploadConfig,
    });
    const timeoutResponse = await timeoutHandler(imageRequest());
    expect(timeoutResponse.status).toBe(504);
    expect(await envelope(timeoutResponse)).toMatchObject({
      error: { code: "PROVIDER_TIMEOUT", retryable: true },
      ok: false,
    });
  });

  it("maps explicit provider errors to fixed public responses", async () => {
    for (const [code, status] of [
      ["PROVIDER_RATE_LIMITED", 429],
      ["PROVIDER_TIMEOUT", 504],
      ["PROVIDER_UNAVAILABLE", 503],
    ] as const) {
      const provider: AnalysisProvider = {
        extract: vi.fn(async () => {
          throw new AnalysisFailure(code);
        }),
        kind: "openai",
      };
      const handler = createAnalyzeHandler({
        generateSafetyIdentifier: () => firstSafetyIdentifier,
        logger: vi.fn(),
        providerFactory: () => provider,
        uploadConfig,
      });
      const response = await handler(imageRequest());
      expect(response.status).toBe(status);
      expect(await envelope(response)).toMatchObject({
        error: { code, retryable: true },
        ok: false,
      });
    }
  });
});
