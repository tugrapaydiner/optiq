import type { ChartLesson } from "@/lib/contracts/chart";
import {
  CONTRACT_LIMITS,
  type ContractValidationResult,
  type ReviewedLesson,
  validateReviewedLesson,
} from "@/lib/contracts/common";
import type { ProcessLesson } from "@/lib/contracts/process";
import {
  validateChartLesson,
  validateProcessLesson,
} from "@/lib/contracts/semantic-validation";

export const REVIEW_ACKNOWLEDGEMENT =
  "I reviewed the extracted values, labels, order, and relationships and understand that AI-generated content can be incorrect.";

export type ReviewMode = "chart" | "process";
export type ReviewLesson = ChartLesson | ProcessLesson;

export type TeacherReviewState<
  TLesson extends ReviewLesson = ReviewLesson,
> = ReviewedLesson<TLesson> & {
  fieldErrors: Record<string, string>;
  rawValues: Record<string, string>;
};

export type ExportEligibility =
  | { allowed: true }
  | { allowed: false; focusTarget?: string; reasons: string[] };

export type ResolutionResult<TLesson extends ReviewLesson = ReviewLesson> = {
  accepted: boolean;
  message: string;
  state: TeacherReviewState<TLesson>;
};

export type ReviewSummary = {
  modifiedFields: number;
  unresolvedCritical: number;
  warnings: number;
};

const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function cloneLesson<TLesson extends ReviewLesson>(lesson: TLesson): TLesson {
  return structuredClone(lesson);
}

function isChartLesson(lesson: ReviewLesson): lesson is ChartLesson {
  return "chartType" in lesson;
}

function validateDraft(
  mode: ReviewMode,
  lesson: ReviewLesson,
): ContractValidationResult {
  return mode === "chart"
    ? validateChartLesson(lesson)
    : validateProcessLesson(lesson);
}

export function createTeacherReviewState<TLesson extends ReviewLesson>(
  lesson: TLesson,
): TeacherReviewState<TLesson> {
  return {
    draft: cloneLesson(lesson),
    fieldErrors: {},
    modifiedPaths: [],
    original: cloneLesson(lesson),
    rawValues: {},
    resolvedReviewItemIds: [],
    reviewerAcknowledged: false,
  };
}

function segments(targetPath: string): string[] {
  return targetPath.startsWith("/") ? targetPath.slice(1).split("/") : [];
}

export function getTargetValue(
  lesson: ReviewLesson,
  targetPath: string,
): string | number | null | undefined {
  const path = segments(targetPath);
  if (path.length === 1 && (path[0] === "title" || path[0] === "summary")) {
    return lesson[path[0]];
  }

  if (isChartLesson(lesson)) {
    if (path.length === 2 && path[0] === "xAxis") {
      return path[1] === "label" || path[1] === "unit"
        ? lesson.xAxis[path[1]]
        : undefined;
    }
    if (path.length === 2 && path[0] === "yAxis") {
      if (path[1] === "label" || path[1] === "unit") {
        return lesson.yAxis[path[1]];
      }
      if (path[1] === "visibleMin" || path[1] === "visibleMax") {
        return lesson.yAxis[path[1]];
      }
    }
    if (path[0] === "series") {
      const series = lesson.series.find(({ id }) => id === path[1]);
      if (!series) return undefined;
      if (path.length === 3 && path[2] === "label") return series.label;
      if (path.length === 5 && path[2] === "points") {
        const point = series.points.find(({ id }) => id === path[3]);
        if (!point) return undefined;
        const field = path[4];
        if (
          field === "xLabel" ||
          field === "value" ||
          field === "displayValue" ||
          field === "status"
        ) {
          return point[field];
        }
      }
    }
    if (path.length === 3 && path[0] === "trends") {
      const trend = lesson.trends.find(({ id }) => id === path[1]);
      if (!trend) return undefined;
      if (path[2] === "text" || path[2] === "status") return trend[path[2]];
    }
    return undefined;
  }

  if (path.length === 3 && path[0] === "nodes") {
    const node = lesson.nodes.find(({ id }) => id === path[1]);
    if (!node) return undefined;
    const field = path[2];
    if (field === "label" || field === "description" || field === "status") {
      return node[field];
    }
  }
  if (path.length === 3 && path[0] === "edges") {
    const edge = lesson.edges.find(({ id }) => id === path[1]);
    if (!edge) return undefined;
    const field = path[2];
    if (
      field === "from" ||
      field === "to" ||
      field === "label" ||
      field === "status"
    ) {
      return edge[field];
    }
  }
  if (path.length === 2 && path[0] === "readingOrder") {
    const index = Number(path[1]);
    return Number.isInteger(index) ? lesson.readingOrder[index] : undefined;
  }
  return undefined;
}

function setTargetValue(
  lesson: ReviewLesson,
  targetPath: string,
  value: string | number | null,
): boolean {
  const path = segments(targetPath);
  if (path.length === 1 && path[0] === "title" && typeof value === "string") {
    lesson.title = value;
    return true;
  }
  if (path.length === 1 && path[0] === "summary" && typeof value === "string") {
    lesson.summary = value;
    return true;
  }

  if (isChartLesson(lesson)) {
    if (path.length === 2 && path[0] === "xAxis") {
      if (path[1] === "label" && typeof value === "string") {
        lesson.xAxis.label = value;
        return true;
      }
      if (path[1] === "unit" && (typeof value === "string" || value === null)) {
        lesson.xAxis.unit = value;
        return true;
      }
    }
    if (path.length === 2 && path[0] === "yAxis") {
      if (path[1] === "label" && typeof value === "string") {
        lesson.yAxis.label = value;
        return true;
      }
      if (path[1] === "unit" && (typeof value === "string" || value === null)) {
        lesson.yAxis.unit = value;
        return true;
      }
      if (
        (path[1] === "visibleMin" || path[1] === "visibleMax") &&
        (typeof value === "number" || value === null)
      ) {
        lesson.yAxis[path[1]] = value;
        return true;
      }
    }
    if (path[0] === "series") {
      const series = lesson.series.find(({ id }) => id === path[1]);
      if (!series) return false;
      if (path.length === 3 && path[2] === "label" && typeof value === "string") {
        series.label = value;
        return true;
      }
      if (path.length === 5 && path[2] === "points") {
        const point = series.points.find(({ id }) => id === path[3]);
        if (!point) return false;
        const field = path[4];
        if (field === "value" && typeof value === "number") {
          point.value = value;
          return true;
        }
        if (
          (field === "xLabel" || field === "displayValue") &&
          typeof value === "string"
        ) {
          point[field] = value;
          return true;
        }
      }
    }
    if (path.length === 3 && path[0] === "trends") {
      const trend = lesson.trends.find(({ id }) => id === path[1]);
      if (!trend) return false;
      if (path[2] === "text" && typeof value === "string") {
        trend.text = value;
        return true;
      }
    }
    return false;
  }

  if (path.length === 3 && path[0] === "nodes") {
    const node = lesson.nodes.find(({ id }) => id === path[1]);
    if (!node) return false;
    if (
      (path[2] === "label" || path[2] === "description") &&
      typeof value === "string"
    ) {
      node[path[2]] = value;
      return true;
    }
  }
  if (path.length === 3 && path[0] === "edges") {
    const edge = lesson.edges.find(({ id }) => id === path[1]);
    if (!edge) return false;
    if ((path[2] === "from" || path[2] === "to") && typeof value === "string") {
      edge[path[2]] = value;
      return true;
    }
    if (
      path[2] === "label" &&
      (typeof value === "string" || value === null)
    ) {
      edge.label = value;
      return true;
    }
  }
  return false;
}

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths)].sort();
}

function pathMatchesOriginal(
  state: TeacherReviewState,
  path: string,
  draft: ReviewLesson,
): boolean {
  return Object.is(
    getTargetValue(state.original, path),
    getTargetValue(draft, path),
  );
}

function modifiedAfter<TLesson extends ReviewLesson>(
  state: TeacherReviewState<TLesson>,
  draft: TLesson,
  changedPaths: readonly string[],
): string[] {
  const next = new Set(state.modifiedPaths);
  changedPaths.forEach((path) => {
    if (pathMatchesOriginal(state, path, draft)) next.delete(path);
    else next.add(path);
  });
  return uniquePaths([...next]);
}

function reopenForPaths<TLesson extends ReviewLesson>(
  state: TeacherReviewState<TLesson>,
  draft: TLesson,
  changedPaths: readonly string[],
): string[] {
  const changed = new Set(changedPaths);
  const reopenIds = new Set(
    draft.reviewItems
      .filter(({ targetPath }) => changed.has(targetPath))
      .map(({ id }) => id),
  );
  return state.resolvedReviewItemIds.filter((id) => !reopenIds.has(id));
}

function nextReviewId(lesson: ChartLesson, trendId: string): string {
  const used = new Set(lesson.reviewItems.map(({ id }) => id));
  const base = `stale-${trendId}`.slice(0, CONTRACT_LIMITS.id);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (suffix < 100) {
    const tail = `-${suffix}`;
    const candidate = `${base.slice(0, CONTRACT_LIMITS.id - tail.length)}${tail}`;
    if (!used.has(candidate)) return candidate;
    suffix += 1;
  }
  return `stale-trend-${lesson.reviewItems.length}`;
}

function invalidateChartTrends(
  draft: ChartLesson,
): { changedPaths: string[]; reopenedIds: string[] } {
  const changedPaths: string[] = [];
  const reopenedIds: string[] = [];
  draft.trends.forEach((trend) => {
    trend.status = "unclear";
    changedPaths.push(`/trends/${trend.id}/status`);
    const targetPath = `/trends/${trend.id}/text`;
    let reviewItem = draft.reviewItems.find(
      ({ severity, targetPath: existingPath }) =>
        severity === "critical" && existingPath === targetPath,
    );
    if (!reviewItem) {
      reviewItem = {
        id: nextReviewId(draft, trend.id),
        message:
          "Chart data changed. Confirm or correct this trend before export.",
        severity: "critical",
        status: "unclear",
        targetPath,
      };
      draft.reviewItems.push(reviewItem);
    }
    reopenedIds.push(reviewItem.id);
  });
  return { changedPaths, reopenedIds };
}

function textLimit(targetPath: string): number {
  if (targetPath === "/title") return CONTRACT_LIMITS.lessonTitle;
  if (targetPath === "/summary") return CONTRACT_LIMITS.summary;
  if (targetPath.endsWith("/description")) return CONTRACT_LIMITS.processDescription;
  if (targetPath.startsWith("/nodes/")) return CONTRACT_LIMITS.processLabel;
  if (targetPath.startsWith("/edges/") && targetPath.endsWith("/label")) {
    return CONTRACT_LIMITS.edgeLabel;
  }
  if (targetPath.startsWith("/trends/")) return CONTRACT_LIMITS.trendText;
  if (targetPath.endsWith("/displayValue")) return CONTRACT_LIMITS.displayValue;
  if (targetPath.endsWith("/unit")) return CONTRACT_LIMITS.unit;
  if (targetPath.includes("/points/") && targetPath.endsWith("/xLabel")) {
    return CONTRACT_LIMITS.pointLabel;
  }
  if (targetPath.startsWith("/series/")) return CONTRACT_LIMITS.seriesLabel;
  return CONTRACT_LIMITS.axisLabel;
}

function nullableTextPath(targetPath: string): boolean {
  return targetPath.endsWith("/unit") ||
    (targetPath.startsWith("/edges/") && targetPath.endsWith("/label"));
}

function textError(targetPath: string, rawValue: string): string | null {
  if (CONTROL_CHARACTER_PATTERN.test(rawValue)) {
    return "Remove control characters from this field.";
  }
  if (!nullableTextPath(targetPath) && rawValue.trim().length === 0) {
    return "Enter a value for this field.";
  }
  if (rawValue !== rawValue.trim()) {
    return "Remove leading or trailing spaces.";
  }
  if (rawValue.length > textLimit(targetPath)) {
    return `Keep this field to ${textLimit(targetPath)} characters or fewer.`;
  }
  return null;
}

function withFieldError(
  state: TeacherReviewState,
  targetPath: string,
  error: string | null,
): Record<string, string> {
  const next = { ...state.fieldErrors };
  if (error) next[targetPath] = error;
  else delete next[targetPath];
  return next;
}

export function updateTextField<TLesson extends ReviewLesson>(
  state: TeacherReviewState<TLesson>,
  targetPath: string,
  rawValue: string,
): TeacherReviewState<TLesson> {
  const draft = cloneLesson(state.draft);
  const error = textError(targetPath, rawValue);
  const value = nullableTextPath(targetPath) && rawValue === "" ? null : rawValue;
  const updated = setTargetValue(draft, targetPath, value);
  const changedPaths = updated ? [targetPath] : [];
  let reopened = reopenForPaths(state, draft, changedPaths);
  if (updated && isPointDataPath(targetPath) && isChartLesson(draft)) {
    const invalidated = invalidateChartTrends(draft);
    changedPaths.push(...invalidated.changedPaths);
    const stale = new Set(invalidated.reopenedIds);
    reopened = reopened.filter((id) => !stale.has(id));
  }
  const fieldErrors = withFieldError(
    state,
    targetPath,
    updated ? error : "This field cannot be edited.",
  );
  return {
    ...state,
    draft,
    fieldErrors,
    modifiedPaths: modifiedAfter(state, draft, changedPaths),
    rawValues: { ...state.rawValues, [targetPath]: rawValue },
    resolvedReviewItemIds: reopened,
    reviewerAcknowledged: false,
  };
}

function isPointDataPath(targetPath: string): boolean {
  return /^\/series\/[a-z0-9][a-z0-9_-]*\/points\/[a-z0-9][a-z0-9_-]*\/(?:value|xLabel|displayValue)$/.test(
    targetPath,
  );
}

export function updateNumberField<TLesson extends ReviewLesson>(
  state: TeacherReviewState<TLesson>,
  targetPath: string,
  rawValue: string,
): TeacherReviewState<TLesson> {
  const trimmed = rawValue.trim();
  const parsed = Number(trimmed);
  if (trimmed.length === 0 || !Number.isFinite(parsed)) {
    return {
      ...state,
      fieldErrors: withFieldError(
        state,
        targetPath,
        "Enter a finite number.",
      ),
      rawValues: { ...state.rawValues, [targetPath]: rawValue },
      resolvedReviewItemIds: reopenForPaths(state, state.draft, [targetPath]),
      reviewerAcknowledged: false,
    };
  }

  const draft = cloneLesson(state.draft);
  if (!setTargetValue(draft, targetPath, parsed)) {
    return {
      ...state,
      fieldErrors: withFieldError(
        state,
        targetPath,
        "This numeric field cannot be edited.",
      ),
      rawValues: { ...state.rawValues, [targetPath]: rawValue },
      reviewerAcknowledged: false,
    };
  }

  const changedPaths = [targetPath];
  const pointMatch = targetPath.match(
    /^(\/series\/[a-z0-9][a-z0-9_-]*\/points\/[a-z0-9][a-z0-9_-]*)\/value$/,
  );
  if (pointMatch && isChartLesson(draft)) {
    const displayPath = `${pointMatch[1]}/displayValue`;
    setTargetValue(draft, displayPath, trimmed);
    changedPaths.push(displayPath);
  }

  let reopened = reopenForPaths(state, draft, changedPaths);
  if (isPointDataPath(targetPath) && isChartLesson(draft)) {
    const invalidated = invalidateChartTrends(draft);
    changedPaths.push(...invalidated.changedPaths);
    const stale = new Set(invalidated.reopenedIds);
    reopened = reopened.filter((id) => !stale.has(id));
  }

  return {
    ...state,
    draft,
    fieldErrors: withFieldError(state, targetPath, null),
    modifiedPaths: modifiedAfter(state, draft, changedPaths),
    rawValues: { ...state.rawValues, [targetPath]: rawValue },
    resolvedReviewItemIds: reopened,
    reviewerAcknowledged: false,
  };
}

export function updateProcessEdgeEndpoint(
  state: TeacherReviewState<ProcessLesson>,
  edgeId: string,
  endpoint: "from" | "to",
  nodeId: string,
): TeacherReviewState<ProcessLesson> {
  const targetPath = `/edges/${edgeId}/${endpoint}`;
  if (!state.draft.nodes.some(({ id }) => id === nodeId)) {
    return {
      ...state,
      fieldErrors: withFieldError(
        state,
        targetPath,
        "Choose an existing process node.",
      ),
      rawValues: { ...state.rawValues, [targetPath]: nodeId },
      resolvedReviewItemIds: reopenForPaths(state, state.draft, [targetPath]),
      reviewerAcknowledged: false,
    };
  }
  const draft = cloneLesson(state.draft);
  setTargetValue(draft, targetPath, nodeId);
  return {
    ...state,
    draft,
    fieldErrors: withFieldError(state, targetPath, null),
    modifiedPaths: modifiedAfter(state, draft, [targetPath]),
    rawValues: { ...state.rawValues, [targetPath]: nodeId },
    resolvedReviewItemIds: reopenForPaths(state, draft, [targetPath]),
    reviewerAcknowledged: false,
  };
}

export function moveReadingOrder(
  state: TeacherReviewState<ProcessLesson>,
  nodeId: string,
  direction: "up" | "down",
): TeacherReviewState<ProcessLesson> {
  const draft = cloneLesson(state.draft);
  const index = draft.readingOrder.indexOf(nodeId);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= draft.readingOrder.length) {
    return state;
  }
  [draft.readingOrder[index], draft.readingOrder[nextIndex]] = [
    draft.readingOrder[nextIndex]!,
    draft.readingOrder[index]!,
  ];
  const changedPaths = [
    `/readingOrder/${index}`,
    `/readingOrder/${nextIndex}`,
  ];
  return {
    ...state,
    draft,
    modifiedPaths: modifiedAfter(state, draft, changedPaths),
    resolvedReviewItemIds: reopenForPaths(state, draft, changedPaths),
    reviewerAcknowledged: false,
  };
}

export function resolveReviewItem<TLesson extends ReviewLesson>(
  state: TeacherReviewState<TLesson>,
  reviewItemId: string,
  mode: ReviewMode,
): ResolutionResult<TLesson> {
  const item = state.draft.reviewItems.find(({ id }) => id === reviewItemId);
  if (!item) {
    return {
      accepted: false,
      message: "This review item no longer exists.",
      state,
    };
  }
  if (state.fieldErrors[item.targetPath]) {
    return {
      accepted: false,
      message: state.fieldErrors[item.targetPath],
      state,
    };
  }
  const validation = validateDraft(mode, state.draft);
  if (!validation.valid) {
    return {
      accepted: false,
      message: "Fix the invalid draft fields before resolving this item.",
      state,
    };
  }
  return {
    accepted: true,
    message: `${item.severity === "critical" ? "Critical" : "Warning"} review item resolved.`,
    state: {
      ...state,
      resolvedReviewItemIds: uniquePaths([
        ...state.resolvedReviewItemIds,
        reviewItemId,
      ]),
      reviewerAcknowledged: false,
    },
  };
}

export function reopenReviewItem<TLesson extends ReviewLesson>(
  state: TeacherReviewState<TLesson>,
  reviewItemId: string,
): TeacherReviewState<TLesson> {
  return {
    ...state,
    resolvedReviewItemIds: state.resolvedReviewItemIds.filter(
      (id) => id !== reviewItemId,
    ),
    reviewerAcknowledged: false,
  };
}

export function setReviewerAcknowledged<TLesson extends ReviewLesson>(
  state: TeacherReviewState<TLesson>,
  acknowledged: boolean,
): TeacherReviewState<TLesson> {
  return { ...state, reviewerAcknowledged: acknowledged };
}

export function reviewSummary<TLesson extends ReviewLesson>(
  state: TeacherReviewState<TLesson>,
): ReviewSummary {
  const resolved = new Set(state.resolvedReviewItemIds);
  return {
    modifiedFields: new Set(state.modifiedPaths).size,
    unresolvedCritical: state.draft.reviewItems.filter(
      ({ id, severity }) => severity === "critical" && !resolved.has(id),
    ).length,
    warnings: state.draft.reviewItems.filter(
      ({ severity }) => severity === "warning",
    ).length,
  };
}

export function exportEligibility<TLesson extends ReviewLesson>(
  state: TeacherReviewState<TLesson>,
  mode: ReviewMode,
): ExportEligibility {
  const reviewedValidation = validateReviewedLesson(
    state,
    (lesson) => validateDraft(mode, lesson),
  );
  const fieldReasons = Object.values(state.fieldErrors);
  const validationReasons = reviewedValidation.issues
    .filter(({ severity }) => severity === "error")
    .map(({ message }) => message);
  const reasons = [...new Set([...fieldReasons, ...validationReasons])];
  if (reasons.length === 0) return { allowed: true };

  const errorPath = Object.keys(state.fieldErrors)[0];
  const unresolved = state.draft.reviewItems.find(
    ({ id, severity }) =>
      severity === "critical" && !state.resolvedReviewItemIds.includes(id),
  );
  let focusTarget: string | undefined;
  if (errorPath) {
    const item = state.draft.reviewItems.find(
      ({ targetPath }) => targetPath === errorPath,
    );
    focusTarget = item ? `review-item-${item.id}` : "review-errors";
  } else if (unresolved) {
    focusTarget = `review-item-${unresolved.id}`;
  } else if (!state.reviewerAcknowledged) {
    focusTarget = "review-acknowledgement";
  } else {
    focusTarget = "review-errors";
  }

  return { allowed: false, focusTarget, reasons };
}
