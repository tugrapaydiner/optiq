import type { ChartLesson } from "./chart";
import {
  hasReviewForPathPrefix,
  isEditableTargetPath,
  issue,
  resultFromIssues,
  type ContractIssue,
  type ContractValidationResult,
  type ReviewItem,
} from "./common";
import type { ProcessLesson } from "./process";
import {
  validateChartLessonShape,
  validateProcessLessonShape,
} from "./runtime-validation";

function duplicateIds(ids: readonly string[]): boolean {
  return new Set(ids).size !== ids.length;
}

function addReviewPathIssues(
  lesson: unknown,
  reviewItems: readonly ReviewItem[],
  issues: ContractIssue[],
): void {
  reviewItems.forEach((reviewItem, index) => {
    if (!isEditableTargetPath(lesson, reviewItem.targetPath)) {
      issues.push(
        issue(
          "review.target_unresolved",
          `/reviewItems/${index}/targetPath`,
          "The review target does not resolve to an editable lesson field.",
        ),
      );
    }
  });
}

export function validateChartSemantics(
  lesson: ChartLesson,
): ContractValidationResult {
  const issues: ContractIssue[] = [];
  const allIds = [
    ...lesson.series.flatMap((series) => [
      series.id,
      ...series.points.map(({ id }) => id),
    ]),
    ...lesson.trends.map(({ id }) => id),
    ...lesson.reviewItems.map(({ id }) => id),
  ];

  if (duplicateIds(allIds)) {
    issues.push(
      issue(
        "chart.duplicate_id",
        "/",
        "Every series, point, trend, and review item ID must be unique.",
      ),
    );
  }

  if (lesson.supported) {
    if (lesson.chartType !== "bar" && lesson.chartType !== "line") {
      issues.push(
        issue(
          "chart.supported_type",
          "/chartType",
          "A supported chart must be bar or line.",
        ),
      );
    }
    if (lesson.unsupportedReason !== null) {
      issues.push(
        issue(
          "chart.supported_reason",
          "/unsupportedReason",
          "A supported chart must not include an unsupported reason.",
        ),
      );
    }
    if (lesson.series.length < 1 || lesson.series.length > 6) {
      issues.push(
        issue(
          "chart.series_count",
          "/series",
          "A supported chart requires between one and six series.",
        ),
      );
    }
  } else {
    if (!lesson.unsupportedReason) {
      issues.push(
        issue(
          "chart.unsupported_reason",
          "/unsupportedReason",
          "An unsupported chart requires a reason.",
        ),
      );
    }
    if (lesson.chartType !== "unknown") {
      issues.push(
        issue(
          "chart.unsupported_type",
          "/chartType",
          "An unsupported chart must use the unknown chart type.",
        ),
      );
    }
    if (lesson.series.length > 0 || lesson.trends.length > 0) {
      issues.push(
        issue(
          "chart.unsupported_content",
          "/series",
          "An unsupported chart cannot include series or trends.",
        ),
      );
    }
  }

  const totalPoints = lesson.series.reduce(
    (total, series) => total + series.points.length,
    0,
  );
  if (totalPoints > 120) {
    issues.push(
      issue(
        "chart.total_points",
        "/series",
        "A chart cannot contain more than 120 total points.",
      ),
    );
  }

  const expectedLabels = lesson.series[0]?.points.map(({ xLabel }) => xLabel);
  lesson.series.forEach((series, seriesIndex) => {
    if (series.points.length < 1 || series.points.length > 50) {
      issues.push(
        issue(
          "chart.point_count",
          `/series/${seriesIndex}/points`,
          "Each chart series requires between one and fifty points.",
        ),
      );
    }

    const xLabels = series.points.map(({ xLabel }) => xLabel);
    if (new Set(xLabels).size !== xLabels.length) {
      issues.push(
        issue(
          "chart.duplicate_x_label",
          `/series/${seriesIndex}/points`,
          "A series cannot repeat an x-axis label.",
        ),
      );
    }

    if (
      expectedLabels &&
      (xLabels.length !== expectedLabels.length ||
        xLabels.some((label, index) => label !== expectedLabels[index]))
    ) {
      issues.push(
        issue(
          "chart.x_labels_mismatch",
          `/series/${seriesIndex}/points`,
          "Every series must use the same ordered x-axis labels.",
        ),
      );
    }

    series.points.forEach((point, pointIndex) => {
      if (!Number.isFinite(point.value)) {
        issues.push(
          issue(
            "chart.value_not_finite",
            `/series/${seriesIndex}/points/${pointIndex}/value`,
            "Chart values must be finite numbers.",
          ),
        );
      }

      if (
        point.status === "unclear" &&
        !hasReviewForPathPrefix(
          lesson.reviewItems,
          `/series/${series.id}/points/${point.id}/`,
          "critical",
        )
      ) {
        issues.push(
          issue(
            "chart.unclear_point_review",
            `/series/${seriesIndex}/points/${pointIndex}/status`,
            "Every unclear chart point requires a critical review item.",
          ),
        );
      }
    });
  });

  if (
    lesson.yAxis.visibleMin !== null &&
    !Number.isFinite(lesson.yAxis.visibleMin)
  ) {
    issues.push(
      issue(
        "chart.axis_min_not_finite",
        "/yAxis/visibleMin",
        "The visible minimum must be finite.",
      ),
    );
  }
  if (
    lesson.yAxis.visibleMax !== null &&
    !Number.isFinite(lesson.yAxis.visibleMax)
  ) {
    issues.push(
      issue(
        "chart.axis_max_not_finite",
        "/yAxis/visibleMax",
        "The visible maximum must be finite.",
      ),
    );
  }
  if (
    lesson.yAxis.visibleMin !== null &&
    lesson.yAxis.visibleMax !== null &&
    lesson.yAxis.visibleMin >= lesson.yAxis.visibleMax
  ) {
    issues.push(
      issue(
        "chart.axis_bounds",
        "/yAxis",
        "The visible minimum must be lower than the visible maximum.",
      ),
    );
  }

  addReviewPathIssues(lesson, lesson.reviewItems, issues);
  return resultFromIssues(issues);
}

function hasDirectedCycle(lesson: ProcessLesson): boolean {
  const adjacency = new Map<string, string[]>();
  lesson.nodes.forEach(({ id }) => adjacency.set(id, []));
  lesson.edges.forEach(({ from, to }) => adjacency.get(from)?.push(to));

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visiting.add(nodeId);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (visit(neighbor)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  return lesson.nodes.some(({ id }) => visit(id));
}

function disconnectedNodeIds(lesson: ProcessLesson): string[] {
  const firstNode = lesson.nodes[0]?.id;
  if (!firstNode) return [];

  const adjacency = new Map<string, Set<string>>();
  lesson.nodes.forEach(({ id }) => adjacency.set(id, new Set()));
  lesson.edges.forEach(({ from, to }) => {
    adjacency.get(from)?.add(to);
    adjacency.get(to)?.add(from);
  });

  const reached = new Set<string>();
  const queue = [firstNode];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || reached.has(nodeId)) continue;
    reached.add(nodeId);
    queue.push(...(adjacency.get(nodeId) ?? []));
  }

  return lesson.nodes.map(({ id }) => id).filter((id) => !reached.has(id));
}

export function validateProcessSemantics(
  lesson: ProcessLesson,
): ContractValidationResult {
  const issues: ContractIssue[] = [];
  const allIds = [
    ...lesson.nodes.map(({ id }) => id),
    ...lesson.edges.map(({ id }) => id),
    ...lesson.reviewItems.map(({ id }) => id),
  ];

  if (duplicateIds(allIds)) {
    issues.push(
      issue(
        "process.duplicate_id",
        "/",
        "Every node, edge, and review item ID must be unique.",
      ),
    );
  }

  if (lesson.supported) {
    if (lesson.unsupportedReason !== null) {
      issues.push(
        issue(
          "process.supported_reason",
          "/unsupportedReason",
          "A supported process must not include an unsupported reason.",
        ),
      );
    }
    if (lesson.nodes.length < 2 || lesson.nodes.length > 30) {
      issues.push(
        issue(
          "process.node_count",
          "/nodes",
          "A supported process requires between two and thirty nodes.",
        ),
      );
    }
    if (lesson.edges.length < 1 || lesson.edges.length > 60) {
      issues.push(
        issue(
          "process.edge_count",
          "/edges",
          "A supported process requires between one and sixty edges.",
        ),
      );
    }
  } else {
    if (!lesson.unsupportedReason) {
      issues.push(
        issue(
          "process.unsupported_reason",
          "/unsupportedReason",
          "An unsupported process requires a reason.",
        ),
      );
    }
    if (
      lesson.nodes.length > 0 ||
      lesson.edges.length > 0 ||
      lesson.readingOrder.length > 0
    ) {
      issues.push(
        issue(
          "process.unsupported_content",
          "/nodes",
          "An unsupported process cannot include nodes, edges, or reading order.",
        ),
      );
    }
  }

  const nodeIds = new Set(lesson.nodes.map(({ id }) => id));
  lesson.nodes.forEach((node, nodeIndex) => {
    if (
      node.status === "unclear" &&
      !hasReviewForPathPrefix(
        lesson.reviewItems,
        `/nodes/${node.id}/`,
        "critical",
      )
    ) {
      issues.push(
        issue(
          "process.unclear_node_review",
          `/nodes/${nodeIndex}/status`,
          "Every unclear node requires a critical review item.",
        ),
      );
    }
  });

  lesson.edges.forEach((edge, edgeIndex) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      issues.push(
        issue(
          "process.edge_reference",
          `/edges/${edgeIndex}`,
          "Every edge endpoint must reference an existing node.",
        ),
      );
    }
    if (
      edge.from === edge.to &&
      !hasReviewForPathPrefix(lesson.reviewItems, `/edges/${edge.id}/`)
    ) {
      issues.push(
        issue(
          "process.self_loop_review",
          `/edges/${edgeIndex}`,
          "A self-loop requires an explicit review item.",
        ),
      );
    }
    if (
      edge.status === "unclear" &&
      !hasReviewForPathPrefix(
        lesson.reviewItems,
        `/edges/${edge.id}/`,
        "critical",
      )
    ) {
      issues.push(
        issue(
          "process.unclear_edge_review",
          `/edges/${edgeIndex}/status`,
          "Every unclear edge requires a critical review item.",
        ),
      );
    }
  });

  const readingOrder = lesson.readingOrder;
  const readingOrderSet = new Set(readingOrder);
  if (readingOrderSet.size !== readingOrder.length) {
    issues.push(
      issue(
        "process.reading_order_duplicate",
        "/readingOrder",
        "Reading order cannot repeat a node.",
      ),
    );
  }
  if (
    readingOrder.length !== lesson.nodes.length ||
    readingOrder.some((id) => !nodeIds.has(id)) ||
    lesson.nodes.some(({ id }) => !readingOrderSet.has(id))
  ) {
    issues.push(
      issue(
        "process.reading_order_coverage",
        "/readingOrder",
        "Reading order must contain every node exactly once and no unknown IDs.",
      ),
    );
  }

  const disconnected = disconnectedNodeIds(lesson);
  if (
    lesson.supported &&
    disconnected.length > 0 &&
    disconnected.some(
      (nodeId) =>
        !hasReviewForPathPrefix(lesson.reviewItems, `/nodes/${nodeId}/`),
    )
  ) {
    issues.push(
      issue(
        "process.disconnected",
        "/nodes",
        "Disconnected process content must be surfaced for review.",
      ),
    );
  }

  if (
    lesson.supported &&
    hasDirectedCycle(lesson) &&
    !/\b(cycle|cyclic|loop|repeat(?:s|ing)?|returns?)\b/i.test(lesson.summary) &&
    !lesson.reviewItems.some(({ targetPath }) => targetPath.startsWith("/edges/"))
  ) {
    issues.push(
      issue(
        "process.cycle_unexplained",
        "/summary",
        "A cyclic process must be explained in the summary or surfaced for review.",
      ),
    );
  }

  addReviewPathIssues(lesson, lesson.reviewItems, issues);
  return resultFromIssues(issues);
}

export function validateChartLesson(value: unknown): ContractValidationResult {
  const syntax = validateChartLessonShape(value);
  return syntax.success
    ? validateChartSemantics(syntax.data)
    : resultFromIssues(syntax.issues);
}

export function validateProcessLesson(value: unknown): ContractValidationResult {
  const syntax = validateProcessLessonShape(value);
  return syntax.success
    ? validateProcessSemantics(syntax.data)
    : resultFromIssues(syntax.issues);
}
