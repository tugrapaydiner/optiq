import { describe, expect, it } from "vitest";

import chartBar01Json from "../../fixtures/gold/chart-bar-01.json";
import chartBar02Json from "../../fixtures/gold/chart-bar-02.json";
import chartLine01Json from "../../fixtures/gold/chart-line-01.json";
import chartLine02Json from "../../fixtures/gold/chart-line-02.json";
import process01Json from "../../fixtures/gold/process-01.json";
import process02Json from "../../fixtures/gold/process-02.json";
import type { AnalyzeMode, AnalyzedLesson } from "../../src/lib/analyze/types";
import type { ChartLesson } from "../../src/lib/contracts/chart";
import type { ProcessLesson } from "../../src/lib/contracts/process";
import {
  parseChartLessonJson,
  parseProcessLessonJson,
} from "../../src/lib/contracts/runtime-validation";
import { evaluateProviderOutput } from "../../src/lib/evaluation/compare";

const FIXTURES: ReadonlyArray<{
  gold: unknown;
  id: string;
  mode: AnalyzeMode;
}> = [
  { gold: chartBar01Json, id: "chart-bar-01", mode: "chart" },
  { gold: chartBar02Json, id: "chart-bar-02", mode: "chart" },
  { gold: chartLine01Json, id: "chart-line-01", mode: "chart" },
  { gold: chartLine02Json, id: "chart-line-02", mode: "chart" },
  { gold: process01Json, id: "process-01", mode: "process" },
  { gold: process02Json, id: "process-02", mode: "process" },
];

function parseGold(mode: AnalyzeMode, value: unknown): AnalyzedLesson {
  const result =
    mode === "chart"
      ? parseChartLessonJson(JSON.stringify(value))
      : parseProcessLessonJson(JSON.stringify(value));
  if (!result.success) throw new Error("Committed gold fixture is invalid.");
  return result.data;
}

function chartGold(value: unknown = chartBar01Json): ChartLesson {
  const result = parseChartLessonJson(JSON.stringify(value));
  if (!result.success) throw new Error("Expected valid chart gold.");
  return structuredClone(result.data);
}

function processGold(value: unknown = process02Json): ProcessLesson {
  const result = parseProcessLessonJson(JSON.stringify(value));
  if (!result.success) throw new Error("Expected valid process gold.");
  return structuredClone(result.data);
}

describe("fixed extraction comparison", () => {
  for (const fixture of FIXTURES) {
    it(`classifies exact owned gold ${fixture.id} as safe and correct`, () => {
      const gold = parseGold(fixture.mode, fixture.gold);
      const result = evaluateProviderOutput(
        fixture.mode,
        gold,
        JSON.stringify(gold),
      );

      expect(result).toMatchObject({
        classification: "SAFE_CORRECT",
        reviewCaughtIssue: "not_applicable",
        schemaValid: true,
        semanticValid: true,
        supportedActual: true,
      });
      expect(result.critical.total).toBeGreaterThan(0);
      expect(result.critical.matched).toBe(result.critical.total);
      expect(result.critical.incorrect).toBe(0);
      expect(result.critical.missing).toBe(0);
    });
  }

  it("compares chart identities by visible labels rather than model-created IDs", () => {
    const gold = chartGold(chartBar02Json);
    const actual = structuredClone(gold);
    actual.title = `${actual.title}!`;
    actual.series.forEach((series, seriesIndex) => {
      series.id = `actual-series-${seriesIndex + 1}`;
      series.points.forEach((point, pointIndex) => {
        point.id = `actual-point-${seriesIndex + 1}-${pointIndex + 1}`;
      });
    });

    const result = evaluateProviderOutput("chart", gold, JSON.stringify(actual));
    expect(result.classification).toBe("SAFE_CORRECT");
    expect(result.critical.matched).toBe(result.critical.total);
  });

  it.each([
    ["chart-bar-01", chartBar01Json],
    ["chart-bar-02", chartBar02Json],
    ["chart-line-01", chartLine01Json],
    ["chart-line-02", chartLine02Json],
  ])(
    "treats a parenthesized axis unit as equivalent for %s when the unit field matches",
    (_fixtureId, fixture) => {
      const gold = chartGold(fixture);
      const actual = structuredClone(gold);
      actual.yAxis.label = `${actual.yAxis.label} (${actual.yAxis.unit})`;

      const result = evaluateProviderOutput(
        "chart",
        gold,
        JSON.stringify(actual),
      );

      expect(result.classification).toBe("SAFE_CORRECT");
      expect(
        result.critical.facts.find(({ id }) => id === "chart.y_axis.label"),
      ).toMatchObject({ outcome: "matched" });
    },
  );

  it("does not hide a different axis label behind a matching unit suffix", () => {
    const gold = chartGold(chartBar02Json);
    const actual = structuredClone(gold);
    actual.yAxis.label = `Median plant height (${actual.yAxis.unit})`;

    const result = evaluateProviderOutput("chart", gold, JSON.stringify(actual));

    expect(result.classification).toBe("UNSAFE_INCORRECT");
    expect(result.unreviewedCriticalFactIds).toContain("chart.y_axis.label");
  });

  it("rejects a silently incorrect verified chart value", () => {
    const gold = chartGold();
    const actual = structuredClone(gold);
    actual.series[0]!.points[0]!.value = 121;
    actual.series[0]!.points[0]!.displayValue = "121";

    const result = evaluateProviderOutput("chart", gold, JSON.stringify(actual));
    expect(result.classification).toBe("UNSAFE_INCORRECT");
    expect(result.reviewCaughtIssue).toBe("no");
    expect(result.unreviewedCriticalFactIds).toContain(
      "chart.series.0.point.0.value",
    );
  });

  it("classifies a wrong chart value as reviewable only when critically flagged", () => {
    const gold = chartGold();
    const actual = structuredClone(gold);
    const point = actual.series[0]!.points[0]!;
    point.value = 121;
    point.displayValue = "121";
    point.status = "unclear";
    actual.reviewItems.push({
      id: "review-chart-value",
      message: "Confirm this exact value before export.",
      severity: "critical",
      status: "unclear",
      targetPath: `/series/${actual.series[0]!.id}/points/${point.id}/value`,
    });

    const result = evaluateProviderOutput("chart", gold, JSON.stringify(actual));
    expect(result).toMatchObject({
      classification: "SAFE_REVIEW",
      reviewCaughtIssue: "yes",
      schemaValid: true,
      semanticValid: true,
    });
    expect(result.unreviewedCriticalFactIds).toEqual([]);
  });

  it("records a valid unsupported response separately from invalid output", () => {
    const gold = chartGold();
    const unsupported: ChartLesson = {
      chartType: "unknown",
      reviewItems: [],
      schemaVersion: "1.0",
      series: [],
      summary: "",
      supported: false,
      title: "",
      trends: [],
      unsupportedReason: "The selected image is not a supported chart.",
      xAxis: { label: "", unit: null },
      yAxis: { label: "", unit: null, visibleMax: null, visibleMin: null },
    };

    const safeUnsupported = evaluateProviderOutput(
      "chart",
      gold,
      JSON.stringify(unsupported),
    );
    const invalid = evaluateProviderOutput("chart", gold, '{"supported":true}');

    expect(safeUnsupported).toMatchObject({
      classification: "SAFE_UNSUPPORTED",
      schemaValid: true,
      semanticValid: true,
      supportedActual: false,
    });
    expect(invalid).toMatchObject({
      classification: "INVALID_OUTPUT",
      schemaValid: false,
      semanticValid: false,
      supportedActual: null,
    });
  });

  it("rejects a silently wrong process edge direction", () => {
    const gold = processGold();
    const actual = structuredClone(gold);
    const loop = actual.edges.at(-1)!;
    loop.to = "condensation";

    const result = evaluateProviderOutput("process", gold, JSON.stringify(actual));
    expect(result).toMatchObject({
      classification: "UNSAFE_INCORRECT",
      reviewCaughtIssue: "no",
      schemaValid: true,
      semanticValid: true,
    });
  });

  it("accepts an incorrect process edge only as explicit critical review", () => {
    const gold = processGold();
    const actual = structuredClone(gold);
    const loop = actual.edges.at(-1)!;
    loop.to = "condensation";
    loop.status = "unclear";
    actual.reviewItems.push({
      id: "review-loop-endpoint",
      message: "Confirm where the loop arrow returns.",
      severity: "critical",
      status: "unclear",
      targetPath: `/edges/${loop.id}/to`,
    });

    const result = evaluateProviderOutput("process", gold, JSON.stringify(actual));
    expect(result).toMatchObject({
      classification: "SAFE_REVIEW",
      reviewCaughtIssue: "yes",
      schemaValid: true,
      semanticValid: true,
    });
    expect(result.unreviewedCriticalFactIds).toEqual([]);
  });

  it("allows an alternate branch reading sequence when coverage is complete", () => {
    const gold = processGold(process01Json);
    const actual = structuredClone(gold);
    [actual.readingOrder[2], actual.readingOrder[3]] = [
      actual.readingOrder[3]!,
      actual.readingOrder[2]!,
    ];

    const result = evaluateProviderOutput("process", gold, JSON.stringify(actual));
    expect(result.classification).toBe("SAFE_CORRECT");
    expect(
      result.critical.facts.find(
        ({ id }) => id === "process.reading_order.coverage",
      ),
    ).toMatchObject({ actual: true, outcome: "matched" });
  });
});
