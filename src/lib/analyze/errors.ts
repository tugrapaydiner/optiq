import type {
  AnalyzeMode,
  PublicAnalysisError,
  PublicErrorCode,
} from "./types";
import { formatUploadLimit } from "../upload/config";

type ErrorContext = {
  maxBytes: number;
  mode?: AnalyzeMode;
  retryable?: boolean;
};

const STATUS_BY_CODE: Readonly<Record<PublicErrorCode, number>> = {
  FILE_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
  INVALID_IMAGE: 422,
  INVALID_MODEL_OUTPUT: 502,
  INVALID_REQUEST: 400,
  PROVIDER_RATE_LIMITED: 429,
  PROVIDER_TIMEOUT: 504,
  PROVIDER_UNAVAILABLE: 503,
  UNSUPPORTED_FILE_TYPE: 415,
  UNSUPPORTED_VISUAL: 422,
};

const RETRYABLE_BY_CODE: Readonly<Record<PublicErrorCode, boolean>> = {
  FILE_TOO_LARGE: false,
  INTERNAL_ERROR: true,
  INVALID_IMAGE: false,
  INVALID_MODEL_OUTPUT: true,
  INVALID_REQUEST: false,
  PROVIDER_RATE_LIMITED: true,
  PROVIDER_TIMEOUT: true,
  PROVIDER_UNAVAILABLE: true,
  UNSUPPORTED_FILE_TYPE: false,
  UNSUPPORTED_VISUAL: false,
};

function messageForCode(code: PublicErrorCode, context: ErrorContext): string {
  switch (code) {
    case "INVALID_REQUEST":
      return "Choose a visual type and one image, then try again.";
    case "UNSUPPORTED_FILE_TYPE":
      return "Choose a PNG, JPEG, or WebP image.";
    case "FILE_TOO_LARGE":
      return `This image is larger than the configured ${formatUploadLimit(context.maxBytes)} limit. Export or resize it, then try again.`;
    case "INVALID_IMAGE":
      return "The file could not be read as a supported image.";
    case "UNSUPPORTED_VISUAL":
      return `Optiq could not create a reliable ${context.mode === "process" ? "process" : "chart"} lesson from this image. Try a clearer supported visual or choose the other mode.`;
    case "PROVIDER_RATE_LIMITED":
      return "Live analysis is temporarily busy. Try again shortly or explore a built-in sample.";
    case "PROVIDER_TIMEOUT":
      return "Analysis took too long. Your image was not saved by Optiq. Try again with a smaller or clearer image.";
    case "PROVIDER_UNAVAILABLE":
      return "Live analysis is temporarily unavailable. Try again shortly or explore a built-in sample.";
    case "INVALID_MODEL_OUTPUT":
      return "The analysis did not pass Optiq's safety checks, so no lesson was created. Try a clearer image.";
    case "INTERNAL_ERROR":
      return "Optiq could not complete this analysis. Try again shortly.";
  }
}

export class AnalysisFailure extends Error {
  readonly code: PublicErrorCode;
  readonly retryable?: boolean;

  constructor(code: PublicErrorCode, retryable?: boolean) {
    super(code);
    this.name = "AnalysisFailure";
    this.code = code;
    this.retryable = retryable;
  }
}

export function toPublicError(
  code: PublicErrorCode,
  context: ErrorContext,
): PublicAnalysisError {
  return {
    code,
    message: messageForCode(code, context),
    retryable: context.retryable ?? RETRYABLE_BY_CODE[code],
  };
}

export function statusForError(code: PublicErrorCode): number {
  return STATUS_BY_CODE[code];
}
