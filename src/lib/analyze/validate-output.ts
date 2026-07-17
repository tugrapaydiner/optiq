import type { ChartLesson } from "../contracts/chart";
import type { ProcessLesson } from "../contracts/process";
import {
  parseChartLessonJson,
  parseProcessLessonJson,
} from "../contracts/runtime-validation";
import {
  validateChartSemantics,
  validateProcessSemantics,
} from "../contracts/semantic-validation";
import { PROVIDER_OUTPUT_MAX_BYTES } from "../upload/config";
import { AnalysisFailure } from "./errors";
import type { AnalyzeMode, AnalyzedLesson } from "./types";

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach((nested) => deepFreeze(nested));
  return value;
}

function ensureSupported(lesson: ChartLesson | ProcessLesson): void {
  if (!lesson.supported) throw new AnalysisFailure("UNSUPPORTED_VISUAL");
}

export function validateProviderOutput(
  mode: AnalyzeMode,
  outputText: string,
): Readonly<AnalyzedLesson> {
  if (
    outputText.trim().length === 0 ||
    Buffer.byteLength(outputText, "utf8") > PROVIDER_OUTPUT_MAX_BYTES
  ) {
    throw new AnalysisFailure("INVALID_MODEL_OUTPUT");
  }

  if (mode === "chart") {
    const syntax = parseChartLessonJson(outputText);
    if (!syntax.success) throw new AnalysisFailure("INVALID_MODEL_OUTPUT");
    const semantics = validateChartSemantics(syntax.data);
    if (!semantics.valid) throw new AnalysisFailure("INVALID_MODEL_OUTPUT");
    ensureSupported(syntax.data);
    return deepFreeze(syntax.data);
  }

  const syntax = parseProcessLessonJson(outputText);
  if (!syntax.success) throw new AnalysisFailure("INVALID_MODEL_OUTPUT");
  const semantics = validateProcessSemantics(syntax.data);
  if (!semantics.valid) throw new AnalysisFailure("INVALID_MODEL_OUTPUT");
  ensureSupported(syntax.data);
  return deepFreeze(syntax.data);
}
