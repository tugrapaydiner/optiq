import { describe, expect, it } from "vitest";

import {
  isEditableTargetPath,
  resolveTargetPath,
  validateReviewedLesson,
} from "@/lib/contracts/common";
import {
  validateChartLesson,
  validateChartSemantics,
  validateProcessSemantics,
} from "@/lib/contracts/semantic-validation";

import {
  makeChartLesson,
  makeProcessLesson,
  makeUnsupportedChartLesson,
  makeUnsupportedProcessLesson,
} from "./test-lessons";

function codes(result: ReturnType<typeof validateChartSemantics>): string[] {
  return result.issues.map(({ code }) => code);
}

describe("chart semantic validation", () => {
  it("accepts valid minimal and practical-maximum charts", () => {
    const minimal = makeChartLesson();
    minimal.series[0]!.points = [minimal.series[0]!.points[0]!];
    expect(validateChartSemantics(minimal).valid).toBe(true);

    const maximum = makeChartLesson();
    maximum.series = Array.from({ length: 6 }, (_, seriesIndex) => ({
      id: `series-${seriesIndex}`,
      label: `Series ${seriesIndex}`,
      points: Array.from({ length: 20 }, (_, pointIndex) => ({
        id: `series-${seriesIndex}-point-${pointIndex}`,
        xLabel: `Point ${pointIndex}`,
        value: pointIndex,
        displayValue: String(pointIndex),
        status: "verified_visible_text" as const,
      })),
    }));
    maximum.trends = [];
    expect(validateChartSemantics(maximum).valid).toBe(true);
  });

  it("accepts the canonical unsupported shape and rejects mismatched states", () => {
    expect(validateChartSemantics(makeUnsupportedChartLesson()).valid).toBe(true);

    const missingReason = makeUnsupportedChartLesson();
    missingReason.unsupportedReason = "";
    missingReason.chartType = "bar";
    missingReason.series = makeChartLesson().series;
    expect(codes(validateChartSemantics(missingReason))).toEqual(
      expect.arrayContaining([
        "chart.unsupported_content",
        "chart.unsupported_reason",
        "chart.unsupported_type",
      ]),
    );

    const supportedUnknown = makeChartLesson();
    supportedUnknown.chartType = "unknown";
    supportedUnknown.unsupportedReason = "A contradictory reason.";
    expect(codes(validateChartSemantics(supportedUnknown))).toEqual(
      expect.arrayContaining(["chart.supported_reason", "chart.supported_type"]),
    );
  });

  it("rejects duplicate IDs, duplicate x labels, and incompatible series labels", () => {
    const lesson = makeChartLesson();
    lesson.series[0]!.points[1]!.id = lesson.series[0]!.id;
    lesson.series[0]!.points[1]!.xLabel = "Jan";
    lesson.series.push({
      id: "comparison",
      label: "Comparison",
      points: [
        {
          id: "comparison-a",
          xLabel: "January",
          value: 100,
          displayValue: "100",
          status: "verified_visible_text",
        },
        {
          id: "comparison-b",
          xLabel: "February",
          value: 110,
          displayValue: "110",
          status: "verified_visible_text",
        },
      ],
    });

    expect(codes(validateChartSemantics(lesson))).toEqual(
      expect.arrayContaining([
        "chart.duplicate_id",
        "chart.duplicate_x_label",
        "chart.x_labels_mismatch",
      ]),
    );
  });

  it("rejects empty series points, non-finite values, bad bounds, and total overflow", () => {
    const empty = makeChartLesson();
    empty.series[0]!.points = [];
    expect(codes(validateChartSemantics(empty))).toContain("chart.point_count");

    const invalidNumber = makeChartLesson();
    invalidNumber.series[0]!.points[0]!.value = Number.NaN;
    invalidNumber.yAxis.visibleMin = Number.NEGATIVE_INFINITY;
    invalidNumber.yAxis.visibleMax = 0;
    expect(codes(validateChartSemantics(invalidNumber))).toEqual(
      expect.arrayContaining([
        "chart.axis_min_not_finite",
        "chart.value_not_finite",
      ]),
    );

    const badBounds = makeChartLesson();
    badBounds.yAxis.visibleMin = 10;
    badBounds.yAxis.visibleMax = 0;
    expect(codes(validateChartSemantics(badBounds))).toContain("chart.axis_bounds");

    const tooMany = makeChartLesson();
    tooMany.series = Array.from({ length: 3 }, (_, seriesIndex) => ({
      id: `series-${seriesIndex}`,
      label: `Series ${seriesIndex}`,
      points: Array.from({ length: 41 }, (_, pointIndex) => ({
        id: `series-${seriesIndex}-point-${pointIndex}`,
        xLabel: `Point ${pointIndex}`,
        value: pointIndex,
        displayValue: String(pointIndex),
        status: "verified_visible_text" as const,
      })),
    }));
    tooMany.trends = [];
    expect(codes(validateChartSemantics(tooMany))).toContain("chart.total_points");
  });

  it("requires a resolvable critical review item for every unclear point", () => {
    const lesson = makeChartLesson();
    lesson.series[0]!.points[0]!.status = "unclear";
    expect(codes(validateChartSemantics(lesson))).toContain(
      "chart.unclear_point_review",
    );

    lesson.reviewItems.push({
      id: "review-jan-value",
      severity: "critical",
      targetPath: "/series/visits/points/jan/value",
      message: "Confirm the January value.",
      status: "unclear",
    });
    expect(validateChartSemantics(lesson).valid).toBe(true);
  });

  it("treats hostile HTML-looking text as inert contract data", () => {
    const lesson = makeChartLesson();
    lesson.title = "<script>not executed</script>";
    lesson.series[0]!.label = '<img src=x onerror="not executed">';
    expect(validateChartSemantics(lesson).valid).toBe(true);
  });
});

describe("process semantic validation", () => {
  it("accepts valid linear, cyclic, and practical-maximum processes", () => {
    expect(validateProcessSemantics(makeProcessLesson()).valid).toBe(true);

    const cyclic = makeProcessLesson();
    cyclic.summary = "A repeating cycle returns from the finish to the start.";
    cyclic.edges.push({
      id: "finish-to-start",
      from: "finish",
      to: "start",
      label: null,
      status: "inferred_from_layout",
    });
    expect(validateProcessSemantics(cyclic).valid).toBe(true);

    const maximum = makeProcessLesson();
    maximum.summary = "A repeating cycle connects every node.";
    maximum.nodes = Array.from({ length: 30 }, (_, index) => ({
      id: `node-${index}`,
      label: `Node ${index}`,
      description: `Description ${index}`,
      status: "verified_visible_text" as const,
    }));
    maximum.edges = [
      ...Array.from({ length: 30 }, (_, index) => ({
        id: `ring-${index}`,
        from: `node-${index}`,
        to: `node-${(index + 1) % 30}`,
        label: null,
        status: "inferred_from_layout" as const,
      })),
      ...Array.from({ length: 30 }, (_, index) => ({
        id: `skip-${index}`,
        from: `node-${index}`,
        to: `node-${(index + 2) % 30}`,
        label: null,
        status: "inferred_from_layout" as const,
      })),
    ];
    maximum.readingOrder = maximum.nodes.map(({ id }) => id);
    expect(validateProcessSemantics(maximum).valid).toBe(true);
  });

  it("accepts the canonical unsupported shape and rejects unsupported content", () => {
    expect(validateProcessSemantics(makeUnsupportedProcessLesson()).valid).toBe(true);
    const invalid = makeUnsupportedProcessLesson();
    invalid.unsupportedReason = "";
    invalid.nodes = makeProcessLesson().nodes;
    invalid.readingOrder = ["start", "finish"];
    expect(codes(validateProcessSemantics(invalid))).toEqual(
      expect.arrayContaining([
        "process.unsupported_content",
        "process.unsupported_reason",
      ]),
    );
  });

  it("rejects duplicate IDs and missing edge endpoints", () => {
    const lesson = makeProcessLesson();
    lesson.edges[0]!.id = "start";
    lesson.edges[0]!.to = "missing-node";
    expect(codes(validateProcessSemantics(lesson))).toEqual(
      expect.arrayContaining(["process.duplicate_id", "process.edge_reference"]),
    );
  });

  it("rejects missing, duplicate, and unknown reading-order entries", () => {
    const missing = makeProcessLesson();
    missing.readingOrder = ["start"];
    expect(codes(validateProcessSemantics(missing))).toContain(
      "process.reading_order_coverage",
    );

    const duplicate = makeProcessLesson();
    duplicate.readingOrder = ["start", "start"];
    expect(codes(validateProcessSemantics(duplicate))).toEqual(
      expect.arrayContaining([
        "process.reading_order_coverage",
        "process.reading_order_duplicate",
      ]),
    );

    const unknown = makeProcessLesson();
    unknown.readingOrder = ["start", "unknown"];
    expect(codes(validateProcessSemantics(unknown))).toContain(
      "process.reading_order_coverage",
    );
  });

  it("requires critical review for unclear nodes and edges", () => {
    const lesson = makeProcessLesson();
    lesson.nodes[0]!.status = "unclear";
    lesson.edges[0]!.status = "unclear";
    expect(codes(validateProcessSemantics(lesson))).toEqual(
      expect.arrayContaining([
        "process.unclear_edge_review",
        "process.unclear_node_review",
      ]),
    );

    lesson.reviewItems.push(
      {
        id: "review-start-label",
        severity: "critical",
        targetPath: "/nodes/start/label",
        message: "Confirm the start label.",
        status: "unclear",
      },
      {
        id: "review-edge-direction",
        severity: "critical",
        targetPath: "/edges/start-to-finish/to",
        message: "Confirm the arrow direction.",
        status: "unclear",
      },
    );
    expect(validateProcessSemantics(lesson).valid).toBe(true);
  });

  it("requires review for self-loops and disconnected structures", () => {
    const selfLoop = makeProcessLesson();
    selfLoop.edges.push({
      id: "start-loop",
      from: "start",
      to: "start",
      label: null,
      status: "inferred_from_layout",
    });
    expect(codes(validateProcessSemantics(selfLoop))).toContain(
      "process.self_loop_review",
    );

    const disconnected = makeProcessLesson();
    disconnected.nodes.push({
      id: "orphan",
      label: "Separate branch",
      description: "A visibly separate branch.",
      status: "verified_visible_text",
    });
    disconnected.readingOrder.push("orphan");
    expect(codes(validateProcessSemantics(disconnected))).toContain(
      "process.disconnected",
    );
    disconnected.reviewItems.push({
      id: "review-orphan",
      severity: "warning",
      targetPath: "/nodes/orphan/label",
      message: "Confirm the visibly separate branch.",
      status: "inferred_from_layout",
    });
    expect(validateProcessSemantics(disconnected).valid).toBe(true);
  });

  it("requires a cycle to be explained or surfaced for review", () => {
    const lesson = makeProcessLesson();
    lesson.edges.push({
      id: "finish-to-start",
      from: "finish",
      to: "start",
      label: null,
      status: "inferred_from_layout",
    });
    expect(codes(validateProcessSemantics(lesson))).toContain(
      "process.cycle_unexplained",
    );
  });

  it("treats hostile strings as data without changing graph semantics", () => {
    const lesson = makeProcessLesson();
    lesson.nodes[0]!.label = "<script>not executed</script>";
    lesson.nodes[0]!.description = '<img src=x onerror="not executed">';
    expect(validateProcessSemantics(lesson).valid).toBe(true);
  });
});

describe("review target and teacher-review helpers", () => {
  it("resolves stable ID paths only when they identify editable fields", () => {
    const chart = makeChartLesson();
    expect(resolveTargetPath(chart, "/series/visits/points/jan/value")).toEqual({
      resolved: true,
    });
    expect(isEditableTargetPath(chart, "/series/visits/points/jan/value")).toBe(
      true,
    );
    expect(isEditableTargetPath(chart, "/series/visits/points/missing/value")).toBe(
      false,
    );
    expect(isEditableTargetPath(chart, "/schemaVersion")).toBe(false);
  });

  it("rejects unresolved review targets", () => {
    const lesson = makeChartLesson();
    lesson.reviewItems.push({
      id: "missing-target",
      severity: "warning",
      targetPath: "/series/visits/points/missing/value",
      message: "Review a missing point.",
      status: "inferred_from_layout",
    });
    expect(codes(validateChartSemantics(lesson))).toContain("review.target_unresolved");
  });

  it("revalidates edited drafts before marking review ready", () => {
    const original = makeChartLesson();
    const draft = structuredClone(original);
    draft.yAxis.visibleMin = 200;
    draft.yAxis.visibleMax = 100;
    const reviewed = {
      original,
      draft,
      resolvedReviewItemIds: [],
      reviewerAcknowledged: true,
      modifiedPaths: ["/yAxis/visibleMin"],
    };

    expect(codes(validateReviewedLesson(reviewed, validateChartLesson))).toContain(
      "chart.axis_bounds",
    );
    reviewed.draft.yAxis.visibleMin = 0;
    reviewed.draft.yAxis.visibleMax = 200;
    reviewed.draft.title = "x".repeat(161);
    expect(codes(validateReviewedLesson(reviewed, validateChartLesson))).toContain(
      "syntax.maxLength",
    );
    reviewed.draft.title = original.title;
    expect(validateReviewedLesson(reviewed, validateChartLesson).valid).toBe(true);
  });

  it("blocks unsupported, unacknowledged, and unresolved critical drafts", () => {
    const draft = makeUnsupportedChartLesson();
    draft.reviewItems.push({
      id: "critical-title",
      severity: "critical",
      targetPath: "/title",
      message: "Confirm the title.",
      status: "unclear",
    });
    const result = validateReviewedLesson(
      {
        original: structuredClone(draft),
        draft,
        resolvedReviewItemIds: ["does-not-exist"],
        reviewerAcknowledged: false,
        modifiedPaths: ["/schemaVersion"],
      },
      validateChartLesson,
    );

    expect(codes(result)).toEqual(
      expect.arrayContaining([
        "review.acknowledgement_required",
        "review.critical_unresolved",
        "review.modified_path_invalid",
        "review.unknown_resolution",
        "review.unsupported",
      ]),
    );
  });
});
