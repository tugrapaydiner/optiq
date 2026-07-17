import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";

import type { ChartLesson } from "./chart";
import type { ContractIssue } from "./common";
import type { ProcessLesson } from "./process";
import {
  chartLessonJsonSchema,
  processLessonJsonSchema,
} from "../openai/schemas";

export type SyntaxValidationResult<TLesson> =
  | { data: TLesson; issues: []; success: true }
  | { issues: ContractIssue[]; success: false };

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  strictNumbers: true,
});

const validateChart = ajv.compile<ChartLesson>(chartLessonJsonSchema);
const validateProcess = ajv.compile<ProcessLesson>(processLessonJsonSchema);

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  additionalProperties: "Unexpected properties are not allowed.",
  anyOf: "The value has an invalid nullable shape.",
  const: "The value does not match the required contract version.",
  enum: "The value is outside the supported set.",
  maxItems: "The array exceeds its contract limit.",
  maxLength: "The string exceeds its contract limit.",
  minItems: "The array is missing required entries.",
  minLength: "The string is missing required text.",
  pattern: "The string has an invalid format.",
  required: "A required property is missing.",
  type: "The value has the wrong JSON type.",
};

function normalizeAjvIssues(errors: ErrorObject[] | null | undefined): ContractIssue[] {
  return (errors ?? [])
    .map((error) => ({
      code: `syntax.${error.keyword}`,
      message:
        ERROR_MESSAGES[error.keyword] ?? "The value does not match the lesson schema.",
      path: error.instancePath || "/",
      severity: "error" as const,
    }))
    .sort((left, right) => {
      if (left.path !== right.path) return left.path < right.path ? -1 : 1;
      if (left.code === right.code) return 0;
      return left.code < right.code ? -1 : 1;
    });
}

function validateShape<TLesson>(
  value: unknown,
  validator: ValidateFunction<TLesson>,
): SyntaxValidationResult<TLesson> {
  if (validator(value)) {
    return { data: value, issues: [], success: true };
  }

  return { issues: normalizeAjvIssues(validator.errors), success: false };
}

function parseJson<TLesson>(
  serialized: string,
  validator: ValidateFunction<TLesson>,
): SyntaxValidationResult<TLesson> {
  let value: unknown;

  try {
    value = JSON.parse(serialized);
  } catch {
    return {
      issues: [
        {
          code: "syntax.invalid_json",
          message: "The provider output is not valid JSON.",
          path: "/",
          severity: "error",
        },
      ],
      success: false,
    };
  }

  return validateShape(value, validator);
}

export function validateChartLessonShape(
  value: unknown,
): SyntaxValidationResult<ChartLesson> {
  return validateShape(value, validateChart);
}

export function validateProcessLessonShape(
  value: unknown,
): SyntaxValidationResult<ProcessLesson> {
  return validateShape(value, validateProcess);
}

export function parseChartLessonJson(
  serialized: string,
): SyntaxValidationResult<ChartLesson> {
  return parseJson(serialized, validateChart);
}

export function parseProcessLessonJson(
  serialized: string,
): SyntaxValidationResult<ProcessLesson> {
  return parseJson(serialized, validateProcess);
}
