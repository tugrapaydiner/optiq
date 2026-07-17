import type { ChartLesson } from "@/lib/contracts/chart";
import type { ProcessLesson } from "@/lib/contracts/process";

export const ANALYZE_MODES = ["chart", "process"] as const;

export type AnalyzeMode = (typeof ANALYZE_MODES)[number];
export type AnalysisProviderKind = "fixture" | "openai";
export type AnalyzedLesson = ChartLesson | ProcessLesson;

export type PublicErrorCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "INVALID_IMAGE"
  | "UNSUPPORTED_VISUAL"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_MODEL_OUTPUT"
  | "INTERNAL_ERROR";

export type PublicAnalysisError = {
  code: PublicErrorCode;
  message: string;
  retryable: boolean;
};

export type AnalyzeSuccessEnvelope = {
  lesson: AnalyzedLesson;
  mode: AnalyzeMode;
  ok: true;
  provider: AnalysisProviderKind;
  requestId: string;
};

export type AnalyzeErrorEnvelope = {
  error: PublicAnalysisError;
  ok: false;
  requestId: string;
};

export type AnalyzeEnvelope = AnalyzeSuccessEnvelope | AnalyzeErrorEnvelope;
