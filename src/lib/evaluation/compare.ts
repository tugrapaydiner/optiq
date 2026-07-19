import type { AnalyzeMode, AnalyzedLesson } from "../analyze/types";
import type { ChartLesson } from "../contracts/chart";
import type { ReviewItem, ReviewStatus } from "../contracts/common";
import type { ProcessLesson, ProcessNode } from "../contracts/process";
import {
  parseChartLessonJson,
  parseProcessLessonJson,
} from "../contracts/runtime-validation";
import {
  validateChartSemantics,
  validateProcessSemantics,
} from "../contracts/semantic-validation";

export const EVALUATION_CLASSES = [
  "SAFE_CORRECT",
  "SAFE_REVIEW",
  "SAFE_UNSUPPORTED",
  "UNSAFE_INCORRECT",
  "INVALID_OUTPUT",
] as const;

export type EvaluationClass = (typeof EVALUATION_CLASSES)[number];
export type ReviewCatchResult = "no" | "not_applicable" | "yes";
export type FactOutcome = "incorrect" | "matched" | "missing";
export type FactValue = boolean | number | string | null;

export type CriticalFactComparison = {
  actual: FactValue;
  expected: FactValue;
  id: string;
  kind: string;
  outcome: FactOutcome;
  reviewCaught: boolean;
  status: ReviewStatus | null;
  targetPaths: string[];
  unexpected: boolean;
};

export type ExtractionEvaluation = {
  classification: EvaluationClass;
  critical: {
    facts: CriticalFactComparison[];
    incorrect: number;
    matched: number;
    missing: number;
    total: number;
    unexpected: number;
  };
  reviewCaughtIssue: ReviewCatchResult;
  schemaIssueCodes: string[];
  schemaValid: boolean;
  semanticIssueCodes: string[];
  semanticValid: boolean;
  supportedActual: boolean | null;
  supportedExpected: boolean;
  unreviewedCriticalFactIds: string[];
};

type FactAccumulator = {
  facts: CriticalFactComparison[];
  incorrect: number;
  matched: number;
  missing: number;
  total: number;
  unexpected: number;
};

type ExpectedFactInput = {
  actual?: FactValue;
  expected: FactValue;
  id: string;
  kind: string;
  matches: boolean;
  reviewItems: readonly ReviewItem[];
  status?: ReviewStatus;
  targetPaths?: readonly string[];
};

function newAccumulator(): FactAccumulator {
  return {
    facts: [],
    incorrect: 0,
    matched: 0,
    missing: 0,
    total: 0,
    unexpected: 0,
  };
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeTitle(value: string): string {
  return normalizeText(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeAxisLabel(value: string, unit: string | null): string {
  const label = normalizeText(value);
  if (unit === null) return label;

  const parenthesizedUnit = ` (${normalizeText(unit)})`;
  return label.endsWith(parenthesizedUnit)
    ? label.slice(0, -parenthesizedUnit.length).trim()
    : label;
}

function normalizedNullable(value: string | null): string | null {
  return value === null ? null : normalizeText(value);
}

function hasCriticalReview(
  reviewItems: readonly ReviewItem[],
  targetPaths: readonly string[],
): boolean {
  return targetPaths.some((targetPath) =>
    reviewItems.some(
      (item) =>
        item.severity === "critical" && item.targetPath === targetPath,
    ),
  );
}

function addExpectedFact(
  accumulator: FactAccumulator,
  input: ExpectedFactInput,
): void {
  accumulator.total += 1;
  const targetPaths = [...(input.targetPaths ?? [])];
  let outcome: FactOutcome;
  if (input.actual === undefined) {
    outcome = "missing";
    accumulator.missing += 1;
  } else if (input.matches) {
    outcome = "matched";
    accumulator.matched += 1;
  } else {
    outcome = "incorrect";
    accumulator.incorrect += 1;
  }

  accumulator.facts.push({
    actual: input.actual ?? null,
    expected: input.expected,
    id: input.id,
    kind: input.kind,
    outcome,
    reviewCaught:
      outcome === "incorrect" && hasCriticalReview(input.reviewItems, targetPaths),
    status: input.status ?? null,
    targetPaths,
    unexpected: false,
  });
}

function addUnexpectedFact(
  accumulator: FactAccumulator,
  input: {
    actual: FactValue;
    id: string;
    kind: string;
    reviewItems: readonly ReviewItem[];
    status?: ReviewStatus;
    targetPaths?: readonly string[];
  },
): void {
  const targetPaths = [...(input.targetPaths ?? [])];
  accumulator.incorrect += 1;
  accumulator.unexpected += 1;
  accumulator.facts.push({
    actual: input.actual,
    expected: null,
    id: input.id,
    kind: input.kind,
    outcome: "incorrect",
    reviewCaught: hasCriticalReview(input.reviewItems, targetPaths),
    status: input.status ?? null,
    targetPaths,
    unexpected: true,
  });
}

function assignByLabel<TExpected extends { label: string }, TActual extends { label: string }>(
  expected: readonly TExpected[],
  actual: readonly TActual[],
): Array<TActual | undefined> {
  const assignments: Array<TActual | undefined> = Array.from({
    length: expected.length,
  });
  const usedActual = new Set<number>();

  expected.forEach((expectedItem, expectedIndex) => {
    const actualIndex = actual.findIndex(
      (actualItem, candidateIndex) =>
        !usedActual.has(candidateIndex) &&
        normalizeText(actualItem.label) === normalizeText(expectedItem.label),
    );
    if (actualIndex >= 0) {
      assignments[expectedIndex] = actual[actualIndex];
      usedActual.add(actualIndex);
    }
  });

  expected.forEach((_, expectedIndex) => {
    if (assignments[expectedIndex]) return;
    const actualIndex = actual.findIndex(
      (__, candidateIndex) => !usedActual.has(candidateIndex),
    );
    if (actualIndex >= 0) {
      assignments[expectedIndex] = actual[actualIndex];
      usedActual.add(actualIndex);
    }
  });

  return assignments;
}

function compareChart(
  gold: ChartLesson,
  actual: ChartLesson | undefined,
): FactAccumulator {
  const accumulator = newAccumulator();
  const reviewItems = actual?.reviewItems ?? [];
  const scalarFacts: Array<{
    actual: FactValue | undefined;
    expected: FactValue;
    id: string;
    kind: string;
    matches: boolean;
    targetPaths?: string[];
  }> = [
    {
      actual: actual?.title,
      expected: gold.title,
      id: "chart.title",
      kind: "title",
      matches:
        actual !== undefined && normalizeTitle(actual.title) === normalizeTitle(gold.title),
      targetPaths: ["/title"],
    },
    {
      actual: actual?.chartType,
      expected: gold.chartType,
      id: "chart.type",
      kind: "chart_type",
      matches: actual?.chartType === gold.chartType,
    },
    {
      actual: actual?.xAxis.label,
      expected: gold.xAxis.label,
      id: "chart.x_axis.label",
      kind: "axis_label",
      matches:
        actual !== undefined &&
        normalizeAxisLabel(actual.xAxis.label, actual.xAxis.unit) ===
          normalizeAxisLabel(gold.xAxis.label, gold.xAxis.unit),
      targetPaths: ["/xAxis/label"],
    },
    {
      actual: actual?.xAxis.unit,
      expected: gold.xAxis.unit,
      id: "chart.x_axis.unit",
      kind: "unit",
      matches:
        actual !== undefined &&
        normalizedNullable(actual.xAxis.unit) === normalizedNullable(gold.xAxis.unit),
      targetPaths: ["/xAxis/unit"],
    },
    {
      actual: actual?.yAxis.label,
      expected: gold.yAxis.label,
      id: "chart.y_axis.label",
      kind: "axis_label",
      matches:
        actual !== undefined &&
        normalizeAxisLabel(actual.yAxis.label, actual.yAxis.unit) ===
          normalizeAxisLabel(gold.yAxis.label, gold.yAxis.unit),
      targetPaths: ["/yAxis/label"],
    },
    {
      actual: actual?.yAxis.unit,
      expected: gold.yAxis.unit,
      id: "chart.y_axis.unit",
      kind: "unit",
      matches:
        actual !== undefined &&
        normalizedNullable(actual.yAxis.unit) === normalizedNullable(gold.yAxis.unit),
      targetPaths: ["/yAxis/unit"],
    },
    {
      actual: actual?.series.length,
      expected: gold.series.length,
      id: "chart.series.count",
      kind: "series_count",
      matches: actual?.series.length === gold.series.length,
    },
  ];
  scalarFacts.forEach((fact) =>
    addExpectedFact(accumulator, { ...fact, reviewItems }),
  );

  const assignments = assignByLabel(gold.series, actual?.series ?? []);
  const assignedSeries = new Set(assignments.filter(Boolean));
  gold.series.forEach((expectedSeries, seriesIndex) => {
    const actualSeries = assignments[seriesIndex];
    const seriesPath = actualSeries ? `/series/${actualSeries.id}` : null;
    addExpectedFact(accumulator, {
      actual: actualSeries?.label,
      expected: expectedSeries.label,
      id: `chart.series.${seriesIndex}.label`,
      kind: "series_label",
      matches:
        actualSeries !== undefined &&
        normalizeText(actualSeries.label) === normalizeText(expectedSeries.label),
      reviewItems,
      targetPaths: seriesPath ? [`${seriesPath}/label`] : [],
    });
    addExpectedFact(accumulator, {
      actual: actualSeries?.points.length,
      expected: expectedSeries.points.length,
      id: `chart.series.${seriesIndex}.points.count`,
      kind: "point_count",
      matches: actualSeries?.points.length === expectedSeries.points.length,
      reviewItems,
    });

    expectedSeries.points.forEach((expectedPoint, pointIndex) => {
      const actualPoint = actualSeries?.points[pointIndex];
      const pointPath =
        actualSeries && actualPoint
          ? `/series/${actualSeries.id}/points/${actualPoint.id}`
          : null;
      addExpectedFact(accumulator, {
        actual: actualPoint?.xLabel,
        expected: expectedPoint.xLabel,
        id: `chart.series.${seriesIndex}.point.${pointIndex}.x_label`,
        kind: "x_label",
        matches:
          actualPoint !== undefined &&
          normalizeText(actualPoint.xLabel) === normalizeText(expectedPoint.xLabel),
        reviewItems,
        status: actualPoint?.status,
        targetPaths: pointPath ? [`${pointPath}/xLabel`] : [],
      });
      addExpectedFact(accumulator, {
        actual: actualPoint?.value,
        expected: expectedPoint.value,
        id: `chart.series.${seriesIndex}.point.${pointIndex}.value`,
        kind: "numeric_value",
        matches: actualPoint?.value === expectedPoint.value,
        reviewItems,
        status: actualPoint?.status,
        targetPaths: pointPath ? [`${pointPath}/value`] : [],
      });
    });

    actualSeries?.points
      .slice(expectedSeries.points.length)
      .forEach((point, extraIndex) => {
        addUnexpectedFact(accumulator, {
          actual: `${point.xLabel}: ${point.value}`,
          id: `chart.series.${seriesIndex}.point.extra.${extraIndex}`,
          kind: "unexpected_point",
          reviewItems,
          status: point.status,
          targetPaths: [
            `/series/${actualSeries.id}/points/${point.id}/xLabel`,
            `/series/${actualSeries.id}/points/${point.id}/value`,
          ],
        });
      });
  });

  actual?.series
    .filter((series) => !assignedSeries.has(series))
    .forEach((series, index) => {
      addUnexpectedFact(accumulator, {
        actual: series.label,
        id: `chart.series.extra.${index}`,
        kind: "unexpected_series",
        reviewItems,
        targetPaths: [`/series/${series.id}/label`],
      });
    });

  return accumulator;
}

function compareProcess(
  gold: ProcessLesson,
  actual: ProcessLesson | undefined,
): FactAccumulator {
  const accumulator = newAccumulator();
  const reviewItems = actual?.reviewItems ?? [];
  addExpectedFact(accumulator, {
    actual: actual?.title,
    expected: gold.title,
    id: "process.title",
    kind: "title",
    matches:
      actual !== undefined && normalizeTitle(actual.title) === normalizeTitle(gold.title),
    reviewItems,
    targetPaths: ["/title"],
  });
  addExpectedFact(accumulator, {
    actual: actual?.nodes.length,
    expected: gold.nodes.length,
    id: "process.nodes.count",
    kind: "node_count",
    matches: actual?.nodes.length === gold.nodes.length,
    reviewItems,
  });

  const nodeAssignments = assignByLabel(gold.nodes, actual?.nodes ?? []);
  const assignedNodes = new Set(nodeAssignments.filter(Boolean));
  const actualNodeByGoldId = new Map<string, ProcessNode>();
  gold.nodes.forEach((expectedNode, nodeIndex) => {
    const actualNode = nodeAssignments[nodeIndex];
    if (actualNode) actualNodeByGoldId.set(expectedNode.id, actualNode);
    addExpectedFact(accumulator, {
      actual: actualNode?.label,
      expected: expectedNode.label,
      id: `process.node.${nodeIndex}.label`,
      kind: "node_label",
      matches:
        actualNode !== undefined &&
        normalizeText(actualNode.label) === normalizeText(expectedNode.label),
      reviewItems,
      status: actualNode?.status,
      targetPaths: actualNode ? [`/nodes/${actualNode.id}/label`] : [],
    });
  });
  actual?.nodes
    .filter((node) => !assignedNodes.has(node))
    .forEach((node, index) => {
      addUnexpectedFact(accumulator, {
        actual: node.label,
        id: `process.node.extra.${index}`,
        kind: "unexpected_node",
        reviewItems,
        status: node.status,
        targetPaths: [`/nodes/${node.id}/label`],
      });
    });

  addExpectedFact(accumulator, {
    actual: actual?.edges.length,
    expected: gold.edges.length,
    id: "process.edges.count",
    kind: "edge_count",
    matches: actual?.edges.length === gold.edges.length,
    reviewItems,
  });

  const usedActualEdges = new Set<number>();
  const unmatchedExpectedEdges: number[] = [];
  gold.edges.forEach((expectedEdge, edgeIndex) => {
    const expectedFrom = actualNodeByGoldId.get(expectedEdge.from)?.id;
    const expectedTo = actualNodeByGoldId.get(expectedEdge.to)?.id;
    const actualEdgeIndex =
      expectedFrom && expectedTo
        ? (actual?.edges.findIndex(
            (edge, candidateIndex) =>
              !usedActualEdges.has(candidateIndex) &&
              edge.from === expectedFrom &&
              edge.to === expectedTo,
          ) ?? -1)
        : -1;
    if (actualEdgeIndex >= 0) {
      usedActualEdges.add(actualEdgeIndex);
      const actualEdge = actual!.edges[actualEdgeIndex]!;
      addExpectedFact(accumulator, {
        actual: `${actualEdge.from} -> ${actualEdge.to}`,
        expected: `${expectedEdge.from} -> ${expectedEdge.to}`,
        id: `process.edge.${edgeIndex}`,
        kind: "directed_edge",
        matches: true,
        reviewItems,
        status: actualEdge.status,
        targetPaths: [
          `/edges/${actualEdge.id}/from`,
          `/edges/${actualEdge.id}/to`,
        ],
      });
    } else {
      unmatchedExpectedEdges.push(edgeIndex);
    }
  });

  const unmatchedActualEdges = (actual?.edges ?? [])
    .map((edge, index) => ({ edge, index }))
    .filter(({ index }) => !usedActualEdges.has(index));
  unmatchedExpectedEdges.forEach((edgeIndex, mismatchIndex) => {
    const expectedEdge = gold.edges[edgeIndex]!;
    const actualEdge = unmatchedActualEdges[mismatchIndex]?.edge;
    if (actualEdge) usedActualEdges.add(unmatchedActualEdges[mismatchIndex]!.index);
    addExpectedFact(accumulator, {
      actual: actualEdge ? `${actualEdge.from} -> ${actualEdge.to}` : undefined,
      expected: `${expectedEdge.from} -> ${expectedEdge.to}`,
      id: `process.edge.${edgeIndex}`,
      kind: "directed_edge",
      matches: false,
      reviewItems,
      status: actualEdge?.status,
      targetPaths: actualEdge
        ? [`/edges/${actualEdge.id}/from`, `/edges/${actualEdge.id}/to`]
        : [],
    });
  });
  (actual?.edges ?? [])
    .map((edge, index) => ({ edge, index }))
    .filter(({ index }) => !usedActualEdges.has(index))
    .forEach(({ edge }, index) => {
      addUnexpectedFact(accumulator, {
        actual: `${edge.from} -> ${edge.to}`,
        id: `process.edge.extra.${index}`,
        kind: "unexpected_edge",
        reviewItems,
        status: edge.status,
        targetPaths: [`/edges/${edge.id}/from`, `/edges/${edge.id}/to`],
      });
    });

  const expectedReadingOrder = gold.readingOrder
    .map((nodeId) => actualNodeByGoldId.get(nodeId)?.id)
    .filter((nodeId): nodeId is string => Boolean(nodeId));
  const actualReadingOrder = actual?.readingOrder ?? [];
  const readingOrderCoversGold =
    expectedReadingOrder.length === gold.readingOrder.length &&
    actualReadingOrder.length === expectedReadingOrder.length &&
    new Set(actualReadingOrder).size === actualReadingOrder.length &&
    expectedReadingOrder.every((nodeId) => actualReadingOrder.includes(nodeId));
  addExpectedFact(accumulator, {
    actual: actual === undefined ? undefined : readingOrderCoversGold,
    expected: true,
    id: "process.reading_order.coverage",
    kind: "reading_order_coverage",
    matches: readingOrderCoversGold,
    reviewItems,
    targetPaths: actualReadingOrder.map((_, index) => `/readingOrder/${index}`),
  });

  return accumulator;
}

function finalizeEvaluation(
  accumulator: FactAccumulator,
  input: {
    actual: AnalyzedLesson | undefined;
    schemaIssueCodes: string[];
    schemaValid: boolean;
    semanticIssueCodes: string[];
    semanticValid: boolean;
    supportedExpected: boolean;
  },
): ExtractionEvaluation {
  const mismatches = accumulator.facts.filter(
    ({ outcome }) => outcome !== "matched",
  );
  const unreviewedCriticalFactIds = mismatches
    .filter(({ reviewCaught }) => !reviewCaught)
    .map(({ id }) => id);
  const criticalReviewCount =
    input.actual?.reviewItems.filter(({ severity }) => severity === "critical")
      .length ?? 0;

  let classification: EvaluationClass;
  if (!input.schemaValid || !input.semanticValid) {
    classification = "INVALID_OUTPUT";
  } else if (!input.actual?.supported) {
    classification = "SAFE_UNSUPPORTED";
  } else if (mismatches.length === 0) {
    classification = criticalReviewCount > 0 ? "SAFE_REVIEW" : "SAFE_CORRECT";
  } else if (unreviewedCriticalFactIds.length === 0) {
    classification = "SAFE_REVIEW";
  } else {
    classification = "UNSAFE_INCORRECT";
  }

  const reviewCaughtIssue: ReviewCatchResult =
    mismatches.length === 0
      ? "not_applicable"
      : unreviewedCriticalFactIds.length === 0
        ? "yes"
        : "no";

  return {
    classification,
    critical: {
      facts: accumulator.facts,
      incorrect: accumulator.incorrect,
      matched: accumulator.matched,
      missing: accumulator.missing,
      total: accumulator.total,
      unexpected: accumulator.unexpected,
    },
    reviewCaughtIssue,
    schemaIssueCodes: [...new Set(input.schemaIssueCodes)].sort(),
    schemaValid: input.schemaValid,
    semanticIssueCodes: [...new Set(input.semanticIssueCodes)].sort(),
    semanticValid: input.semanticValid,
    supportedActual: input.actual?.supported ?? null,
    supportedExpected: input.supportedExpected,
    unreviewedCriticalFactIds,
  };
}

export function evaluateProviderOutput(
  mode: AnalyzeMode,
  gold: AnalyzedLesson,
  outputText: string,
): ExtractionEvaluation {
  if (mode === "chart") {
    if (!("series" in gold)) {
      throw new TypeError("Chart evaluation requires chart gold data.");
    }
    const syntax = parseChartLessonJson(outputText);
    if (!syntax.success) {
      return finalizeEvaluation(compareChart(gold, undefined), {
        actual: undefined,
        schemaIssueCodes: syntax.issues.map(({ code }) => code),
        schemaValid: false,
        semanticIssueCodes: [],
        semanticValid: false,
        supportedExpected: gold.supported,
      });
    }
    const semantics = validateChartSemantics(syntax.data);
    return finalizeEvaluation(compareChart(gold, syntax.data), {
      actual: syntax.data,
      schemaIssueCodes: [],
      schemaValid: true,
      semanticIssueCodes: semantics.issues.map(({ code }) => code),
      semanticValid: semantics.valid,
      supportedExpected: gold.supported,
    });
  }

  if (!("nodes" in gold)) {
    throw new TypeError("Process evaluation requires process gold data.");
  }
  const syntax = parseProcessLessonJson(outputText);
  if (!syntax.success) {
    return finalizeEvaluation(compareProcess(gold, undefined), {
      actual: undefined,
      schemaIssueCodes: syntax.issues.map(({ code }) => code),
      schemaValid: false,
      semanticIssueCodes: [],
      semanticValid: false,
      supportedExpected: gold.supported,
    });
  }
  const semantics = validateProcessSemantics(syntax.data);
  return finalizeEvaluation(compareProcess(gold, syntax.data), {
    actual: syntax.data,
    schemaIssueCodes: [],
    schemaValid: true,
    semanticIssueCodes: semantics.issues.map(({ code }) => code),
    semanticValid: semantics.valid,
    supportedExpected: gold.supported,
  });
}
