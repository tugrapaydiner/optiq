import { randomUUID } from "node:crypto";

import { AnalysisFailure, statusForError, toPublicError } from "./errors";
import type { AnalysisProvider } from "./provider";
import {
  ANALYZE_MODES,
  type AnalyzeEnvelope,
  type AnalyzeMode,
} from "./types";
import { validateProviderOutput } from "./validate-output";
import {
  resolveSafetySession,
  serializeSafetySessionCookie,
} from "../session/safety-session";
import {
  getUploadConfig,
  PROVIDER_TIMEOUT_MS,
  type UploadConfig,
} from "../upload/config";
import {
  isUploadFile,
  validateImageUpload,
  type SupportedImageMimeType,
} from "../upload/validate-image";

export type AnalyzeLogEvent = {
  byteSize?: number;
  durationMs: number;
  mimeType?: SupportedImageMimeType;
  mode?: AnalyzeMode;
  outcome: "error" | "success";
  providerRequestId?: string;
  requestId: string;
  stage:
    | "request"
    | "upload"
    | "provider"
    | "provider_output"
    | "complete";
  tokenInput?: number;
  tokenOutput?: number;
  tokenTotal?: number;
};

type AnalyzeHandlerDependencies = {
  generateRequestId?: () => string;
  generateSafetyIdentifier?: () => string;
  logger?: (event: AnalyzeLogEvent) => void;
  now?: () => number;
  providerFactory: () => AnalysisProvider;
  secureCookies?: boolean;
  timeoutMs?: number;
  uploadConfig?: UploadConfig;
};

function defaultLogger(event: AnalyzeLogEvent): void {
  console.info("optiq.analyze", event);
}

function isAnalyzeMode(value: FormDataEntryValue | null): value is AnalyzeMode {
  return (
    typeof value === "string" &&
    ANALYZE_MODES.some((candidate) => candidate === value)
  );
}

function jsonResponse(
  body: AnalyzeEnvelope,
  status: number,
  safetyCookie: string | null,
): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (safetyCookie !== null) headers.append("Set-Cookie", safetyCookie);
  return new Response(JSON.stringify(body), { headers, status });
}

function linkedTimeoutSignal(
  requestSignal: AbortSignal,
  timeoutMs: number,
): { cleanup: () => void; signal: AbortSignal } {
  const controller = new AbortController();
  const abortFromRequest = (): void => controller.abort(requestSignal.reason);
  if (requestSignal.aborted) abortFromRequest();
  else requestSignal.addEventListener("abort", abortFromRequest, { once: true });

  const timer = setTimeout(
    () => controller.abort(new DOMException("Provider timeout.", "TimeoutError")),
    timeoutMs,
  );
  return {
    cleanup: () => {
      clearTimeout(timer);
      requestSignal.removeEventListener("abort", abortFromRequest);
    },
    signal: controller.signal,
  };
}

function failureFromUnknown(error: unknown): AnalysisFailure {
  if (error instanceof AnalysisFailure) return error;
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return new AnalysisFailure("PROVIDER_TIMEOUT");
  }
  return new AnalysisFailure("INTERNAL_ERROR");
}

export function createAnalyzeHandler(
  dependencies: AnalyzeHandlerDependencies,
): (request: Request) => Promise<Response> {
  const uploadConfig = dependencies.uploadConfig ?? getUploadConfig();
  const secureCookies =
    dependencies.secureCookies ?? process.env.NODE_ENV === "production";
  const generateRequestId = dependencies.generateRequestId ?? randomUUID;
  const logger = dependencies.logger ?? defaultLogger;
  const now = dependencies.now ?? Date.now;
  const timeoutMs = dependencies.timeoutMs ?? PROVIDER_TIMEOUT_MS;

  return async (request: Request): Promise<Response> => {
    const startedAt = now();
    const requestId = generateRequestId();
    let stage: AnalyzeLogEvent["stage"] = "request";
    let mode: AnalyzeMode | undefined;
    let byteSize: number | undefined;
    let mimeType: SupportedImageMimeType | undefined;
    let providerRequestId: string | undefined;

    let safetySession;
    try {
      safetySession = resolveSafetySession(
        request.headers.get("cookie"),
        dependencies.generateSafetyIdentifier,
      );
    } catch {
      const error = toPublicError("INTERNAL_ERROR", {
        maxBytes: uploadConfig.maxBytes,
      });
      return jsonResponse({ error, ok: false, requestId }, 500, null);
    }

    const safetyCookie = safetySession.created
      ? serializeSafetySessionCookie(safetySession.identifier, secureCookies)
      : null;

    try {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        throw new AnalysisFailure("INVALID_REQUEST");
      }

      const modeValue = formData.get("mode");
      const fileValue = formData.get("file");
      if (!isAnalyzeMode(modeValue) || !isUploadFile(fileValue)) {
        throw new AnalysisFailure("INVALID_REQUEST");
      }
      mode = modeValue;
      byteSize = fileValue.size;
      stage = "upload";
      const image = await validateImageUpload(fileValue, uploadConfig);
      mimeType = image.mimeType;

      stage = "provider";
      const provider = dependencies.providerFactory();
      const linkedSignal = linkedTimeoutSignal(request.signal, timeoutMs);
      let extraction;
      try {
        extraction = await provider.extract({
          image,
          mode,
          safetyIdentifier: safetySession.identifier,
          signal: linkedSignal.signal,
        });
      } finally {
        linkedSignal.cleanup();
      }
      providerRequestId = extraction.providerRequestId;

      stage = "provider_output";
      const lesson = validateProviderOutput(mode, extraction.outputText);
      stage = "complete";
      logger({
        byteSize,
        durationMs: Math.max(0, now() - startedAt),
        mimeType,
        mode,
        outcome: "success",
        providerRequestId,
        requestId,
        stage,
        tokenInput: extraction.tokenUsage?.input,
        tokenOutput: extraction.tokenUsage?.output,
        tokenTotal: extraction.tokenUsage?.total,
      });
      return jsonResponse(
        {
          lesson,
          mode,
          ok: true,
          provider: provider.kind,
          requestId,
        },
        200,
        safetyCookie,
      );
    } catch (caught) {
      const failure = failureFromUnknown(caught);
      const publicError = toPublicError(failure.code, {
        maxBytes: uploadConfig.maxBytes,
        mode,
        retryable: failure.retryable,
      });
      logger({
        byteSize,
        durationMs: Math.max(0, now() - startedAt),
        mimeType,
        mode,
        outcome: "error",
        providerRequestId,
        requestId,
        stage,
      });
      return jsonResponse(
        { error: publicError, ok: false, requestId },
        statusForError(failure.code),
        safetyCookie,
      );
    }
  };
}
