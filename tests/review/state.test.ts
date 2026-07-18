import { describe, expect, it } from "vitest";

import type { ReviewItem } from "@/lib/contracts/common";
import {
  createTeacherReviewState,
  exportEligibility,
  moveReadingOrder,
  resolveReviewItem,
  reviewSummary,
  setReviewerAcknowledged,
  updateNumberField,
  updateProcessEdgeEndpoint,
  updateTextField,
} from "@/lib/review/state";
import {
  makeChartLesson,
  makeProcessLesson,
} from "../contracts/test-lessons";

function criticalPointItem(): ReviewItem {
  return {
    id: "review-jan-value",
    message: "Confirm the January value.",
    severity: "critical",
    status: "unclear",
    targetPath: "/series/visits/points/jan/value",
  };
}

function chartWithCriticalItem() {
  const lesson = makeChartLesson();
  lesson.series[0]!.points[0]!.status = "unclear";
  lesson.reviewItems.push(criticalPointItem());
  return lesson;
}

describe("teacher review state", () => {
  it("keeps the original immutable while tracking draft edits by stable path", () => {
    const original = chartWithCriticalItem();
    const state = createTeacherReviewState(original);
    const edited = updateTextField(state, "/title", "Reviewed library visits");

    expect(state.original).not.toBe(state.draft);
    expect(edited.original.title).toBe("Monthly library visits");
    expect(edited.draft.title).toBe("Reviewed library visits");
    expect(edited.modifiedPaths).toEqual(["/title"]);
    expect(original.title).toBe("Monthly library visits");
  });

  it("rejects empty/non-finite numeric input and cannot resolve an invalid item", () => {
    const path = "/series/visits/points/jan/value";
    const state = createTeacherReviewState(chartWithCriticalItem());
    const invalid = updateNumberField(state, path, "");
    const resolution = resolveReviewItem(invalid, "review-jan-value", "chart");

    expect(invalid.fieldErrors[path]).toBe("Enter a finite number.");
    expect(invalid.draft.series[0]!.points[0]!.value).toBe(120);
    expect(resolution.accepted).toBe(false);
    expect(resolution.state.resolvedReviewItemIds).toEqual([]);
    expect(exportEligibility(invalid, "chart").allowed).toBe(false);

    const infinite = updateNumberField(state, path, "Infinity");
    expect(infinite.fieldErrors[path]).toBe("Enter a finite number.");
  });

  it("requires explicit resolution and acknowledgment before eligibility", () => {
    const path = "/series/visits/points/jan/value";
    const state = createTeacherReviewState(chartWithCriticalItem());
    const corrected = updateNumberField(state, path, "125");
    const resolved = resolveReviewItem(corrected, "review-jan-value", "chart");

    expect(resolved.accepted).toBe(true);
    expect(exportEligibility(resolved.state, "chart")).toMatchObject({
      allowed: false,
      focusTarget: expect.stringMatching(/^review-item-stale-/),
    });

    const staleTrend = resolved.state.draft.reviewItems.find(({ id }) =>
      id.startsWith("stale-"),
    )!;
    const trendResolved = resolveReviewItem(resolved.state, staleTrend.id, "chart");
    expect(trendResolved.accepted).toBe(true);
    expect(exportEligibility(trendResolved.state, "chart")).toEqual({
      allowed: false,
      focusTarget: "review-acknowledgement",
      reasons: ["Teacher acknowledgement is required."],
    });

    const acknowledged = setReviewerAcknowledged(trendResolved.state, true);
    expect(exportEligibility(acknowledged, "chart")).toEqual({ allowed: true });
  });

  it("reopens a resolved item and stale trends when a meaningful field changes", () => {
    const path = "/series/visits/points/jan/value";
    const state = createTeacherReviewState(chartWithCriticalItem());
    const corrected = updateNumberField(state, path, "125");
    const itemResolved = resolveReviewItem(corrected, "review-jan-value", "chart");
    const stale = itemResolved.state.draft.reviewItems.find(({ id }) =>
      id.startsWith("stale-"),
    )!;
    const allResolved = resolveReviewItem(itemResolved.state, stale.id, "chart");
    const acknowledged = setReviewerAcknowledged(allResolved.state, true);

    const changedAgain = updateNumberField(acknowledged, path, "130");
    expect(changedAgain.resolvedReviewItemIds).toEqual([]);
    expect(changedAgain.reviewerAcknowledged).toBe(false);
    expect(changedAgain.draft.trends[0]!.status).toBe("unclear");
    expect(changedAgain.draft.reviewItems).toHaveLength(2);
    expect(reviewSummary(changedAgain).unresolvedCritical).toBe(2);
    expect(changedAgain.original.trends[0]!.status).toBe(
      "verified_visible_text",
    );

    const labelChanged = updateTextField(
      createTeacherReviewState(chartWithCriticalItem()),
      "/series/visits/points/jan/xLabel",
      "January",
    );
    expect(labelChanged.draft.trends[0]!.status).toBe("unclear");
    expect(
      labelChanged.draft.reviewItems.some(({ id }) => id.startsWith("stale-")),
    ).toBe(true);
  });

  it("keeps warnings visible but lets acknowledgment cover them", () => {
    const lesson = makeChartLesson();
    lesson.reviewItems.push({
      id: "warning-title",
      message: "Check capitalization.",
      severity: "warning",
      status: "inferred_from_layout",
      targetPath: "/title",
    });
    const state = setReviewerAcknowledged(createTeacherReviewState(lesson), true);

    expect(reviewSummary(state)).toMatchObject({
      unresolvedCritical: 0,
      warnings: 1,
    });
    expect(exportEligibility(state, "chart")).toEqual({ allowed: true });
  });

  it("prevents unknown process endpoints and tracks a controlled valid choice", () => {
    const state = createTeacherReviewState(makeProcessLesson());
    const invalid = updateProcessEdgeEndpoint(
      state,
      "start-to-finish",
      "to",
      "missing",
    );
    expect(invalid.fieldErrors["/edges/start-to-finish/to"]).toBe(
      "Choose an existing process node.",
    );
    expect(invalid.draft.edges[0]!.to).toBe("finish");

    const valid = updateProcessEdgeEndpoint(
      invalid,
      "start-to-finish",
      "from",
      "finish",
    );
    expect(valid.draft.edges[0]!.from).toBe("finish");
    expect(valid.original.edges[0]!.from).toBe("start");
    expect(valid.modifiedPaths).toContain("/edges/start-to-finish/from");
  });

  it("moves process reading order without losing or duplicating nodes", () => {
    const lesson = makeProcessLesson();
    lesson.nodes.push({
      description: "A middle step.",
      id: "middle",
      label: "Middle",
      status: "verified_visible_text",
    });
    lesson.readingOrder = ["start", "middle", "finish"];
    lesson.edges = [
      {
        from: "start",
        id: "start-to-middle",
        label: null,
        status: "inferred_from_layout",
        to: "middle",
      },
      {
        from: "middle",
        id: "middle-to-finish",
        label: null,
        status: "inferred_from_layout",
        to: "finish",
      },
    ];
    const state = createTeacherReviewState(lesson);
    const moved = moveReadingOrder(state, "middle", "down");

    expect(moved.draft.readingOrder).toEqual(["start", "finish", "middle"]);
    expect(new Set(moved.draft.readingOrder)).toEqual(
      new Set(["start", "middle", "finish"]),
    );
    expect(moved.original.readingOrder).toEqual(["start", "middle", "finish"]);
    expect(moved.modifiedPaths).toEqual([
      "/readingOrder/1",
      "/readingOrder/2",
    ]);
  });
});
