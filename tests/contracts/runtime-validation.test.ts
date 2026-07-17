import { describe, expect, it } from "vitest";

import {
  parseChartLessonJson,
  validateChartLessonShape,
  validateProcessLessonShape,
} from "@/lib/contracts/runtime-validation";
import {
  chartLessonJsonSchema,
  chartResponseFormat,
  processLessonJsonSchema,
  processResponseFormat,
} from "@/lib/openai/schemas";

import { makeChartLesson, makeProcessLesson } from "./test-lessons";

describe("strict provider and runtime schemas", () => {
  it("accepts valid chart and process shapes", () => {
    expect(validateChartLessonShape(makeChartLesson()).success).toBe(true);
    expect(validateProcessLessonShape(makeProcessLesson()).success).toBe(true);
  });

  it("rejects extra keys at root and nested object levels", () => {
    const chartWithRootExtra = { ...makeChartLesson(), modelHtml: "<b>bad</b>" };
    const chartWithNestedExtra = makeChartLesson() as ReturnType<
      typeof makeChartLesson
    > & { xAxis: { label: string; unit: string | null; extra?: boolean } };
    chartWithNestedExtra.xAxis.extra = true;

    expect(validateChartLessonShape(chartWithRootExtra).success).toBe(false);
    expect(validateChartLessonShape(chartWithNestedExtra).success).toBe(false);
  });

  it("keeps validation errors stable and does not echo submitted content", () => {
    const secretMarker = "sensitive-user-content-marker";
    const result = validateChartLessonShape({
      ...makeChartLesson(),
      unexpected: secretMarker,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0]).toMatchObject({
        code: "syntax.additionalProperties",
        message: "Unexpected properties are not allowed.",
        path: "/",
      });
      expect(JSON.stringify(result.issues)).not.toContain(secretMarker);
    }
  });

  it("parses valid JSON and returns a content-free invalid JSON error", () => {
    expect(parseChartLessonJson(JSON.stringify(makeChartLesson())).success).toBe(true);
    const invalid = parseChartLessonJson('{"title":"private material"');
    expect(invalid).toEqual({
      issues: [
        {
          code: "syntax.invalid_json",
          message: "The provider output is not valid JSON.",
          path: "/",
          severity: "error",
        },
      ],
      success: false,
    });
  });

  it("enforces string, array, identifier, and control-character limits", () => {
    const longTitle = makeChartLesson();
    longTitle.title = "x".repeat(161);
    expect(validateChartLessonShape(longTitle).success).toBe(false);

    const badIdentifier = makeChartLesson();
    badIdentifier.series[0]!.id = "Uppercase-is-not-allowed";
    expect(validateChartLessonShape(badIdentifier).success).toBe(false);

    const controlCharacter = makeProcessLesson();
    controlCharacter.nodes[0]!.label = "Start\u0000hidden";
    expect(validateProcessLessonShape(controlCharacter).success).toBe(false);

    const tooManyReviewItems = makeProcessLesson();
    tooManyReviewItems.reviewItems = Array.from({ length: 81 }, (_, index) => ({
      id: `review-${index}`,
      severity: "warning" as const,
      targetPath: "/title",
      message: "Review the title.",
      status: "inferred_from_layout" as const,
    }));
    expect(validateProcessLessonShape(tooManyReviewItems).success).toBe(false);
  });

  it("accepts hostile HTML-looking strings strictly as data", () => {
    const lesson = makeChartLesson();
    lesson.title = '<script>alert("not executed")</script>';
    lesson.summary = '<img src=x onerror="not executed">';

    const result = validateChartLessonShape(lesson);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('<script>alert("not executed")</script>');
    }
  });

  it("accepts practical schema maxima", () => {
    const chart = makeChartLesson();
    chart.series = Array.from({ length: 6 }, (_, seriesIndex) => ({
      id: `series-${seriesIndex}`,
      label: `Series ${seriesIndex}`,
      points: Array.from({ length: 20 }, (_, pointIndex) => ({
        id: `s${seriesIndex}-p${pointIndex}`,
        xLabel: `Point ${pointIndex}`,
        value: pointIndex,
        displayValue: String(pointIndex),
        status: "verified_visible_text" as const,
      })),
    }));
    chart.trends = Array.from({ length: 8 }, (_, index) => ({
      id: `trend-${index}`,
      text: `Trend ${index}`,
      status: "verified_visible_text" as const,
    }));
    expect(validateChartLessonShape(chart).success).toBe(true);

    const process = makeProcessLesson();
    process.nodes = Array.from({ length: 30 }, (_, index) => ({
      id: `node-${index}`,
      label: `Node ${index}`,
      description: `Description ${index}`,
      status: "verified_visible_text" as const,
    }));
    process.edges = Array.from({ length: 60 }, (_, index) => ({
      id: `edge-${index}`,
      from: `node-${index % 30}`,
      to: `node-${(index + 1) % 30}`,
      label: null,
      status: "inferred_from_layout" as const,
    }));
    process.readingOrder = process.nodes.map(({ id }) => id);
    expect(validateProcessLessonShape(process).success).toBe(true);
  });

  it("closes every object schema and exposes strict Responses formats", () => {
    const inspect = (schema: unknown): void => {
      if (Array.isArray(schema)) {
        schema.forEach(inspect);
        return;
      }
      if (typeof schema !== "object" || schema === null) return;
      const record = schema as Record<string, unknown>;
      if (record.type === "object") {
        expect(record.additionalProperties).toBe(false);
      }
      Object.values(record).forEach(inspect);
    };

    inspect(chartLessonJsonSchema);
    inspect(processLessonJsonSchema);
    expect(chartResponseFormat).toMatchObject({ type: "json_schema", strict: true });
    expect(processResponseFormat).toMatchObject({ type: "json_schema", strict: true });
  });
});
