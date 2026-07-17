export const REVIEW_STATUSES = [
  "verified_visible_text",
  "inferred_from_layout",
  "unclear",
] as const;

export const REVIEW_SEVERITIES = ["critical", "warning"] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

export type ReviewItem = {
  id: string;
  severity: ReviewSeverity;
  targetPath: string;
  message: string;
  status: ReviewStatus;
};

export type ReviewedLesson<TLesson> = {
  original: TLesson;
  draft: TLesson;
  resolvedReviewItemIds: string[];
  reviewerAcknowledged: boolean;
  modifiedPaths: string[];
};

export type ContractIssue = {
  code: string;
  message: string;
  path: string;
  severity: "error" | "warning";
};

export type ContractValidationResult = {
  issues: ContractIssue[];
  valid: boolean;
};

export const CONTRACT_LIMITS = {
  axisLabel: 120,
  displayValue: 80,
  edgeLabel: 120,
  id: 64,
  lessonTitle: 160,
  pointLabel: 120,
  processDescription: 500,
  processLabel: 160,
  reviewItems: 80,
  reviewMessage: 500,
  seriesLabel: 120,
  summary: 600,
  targetPath: 256,
  trendText: 500,
  unit: 40,
  unsupportedReason: 500,
} as const;

export const ID_PATTERN = "^[a-z0-9][a-z0-9_-]{0,63}$";

// Slash-delimited, project-owned path syntax. Collection members use stable IDs,
// for example /series/visits/points/jan/value or /nodes/seed/label.
export const TARGET_PATH_PATTERN =
  "^/[A-Za-z][A-Za-z0-9]*(?:/[A-Za-z0-9_-]+)*$";

// Empty strings are allowed where the contract permits them. Non-empty strings
// must be trimmed and may contain ordinary tab/newline whitespace, but not other
// ASCII control characters.
export const PLAIN_TEXT_PATTERN =
  "^(?:$|[^\\s\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F](?:[^\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]*[^\\s\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F])?)$";

export const NON_EMPTY_PLAIN_TEXT_PATTERN =
  "^[^\\s\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F](?:[^\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]*[^\\s\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F])?$";

const EDITABLE_PATH_PATTERNS = [
  /^\/(?:title|summary)$/,
  /^\/xAxis\/(?:label|unit)$/,
  /^\/yAxis\/(?:label|unit|visibleMin|visibleMax)$/,
  /^\/series\/[a-z0-9][a-z0-9_-]{0,63}\/label$/,
  /^\/series\/[a-z0-9][a-z0-9_-]{0,63}\/points\/[a-z0-9][a-z0-9_-]{0,63}\/(?:xLabel|value|displayValue|status)$/,
  /^\/trends\/[a-z0-9][a-z0-9_-]{0,63}\/(?:text|status)$/,
  /^\/nodes\/[a-z0-9][a-z0-9_-]{0,63}\/(?:label|description|status)$/,
  /^\/edges\/[a-z0-9][a-z0-9_-]{0,63}\/(?:from|to|label|status)$/,
  /^\/readingOrder\/[0-9]+$/,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveTargetPath(
  document: unknown,
  targetPath: string,
): { resolved: boolean } {
  if (!targetPath.startsWith("/") || targetPath.length > CONTRACT_LIMITS.targetPath) {
    return { resolved: false };
  }

  const segments = targetPath.slice(1).split("/");
  let current: unknown = document;
  let parentSegment: string | undefined;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const indexed =
        parentSegment === "readingOrder" && /^\d+$/.test(segment)
          ? current[Number(segment)]
          : undefined;
      const identified = current.find(
        (item) => isRecord(item) && item.id === segment,
      );
      current = indexed ?? identified;
    } else if (isRecord(current) && Object.hasOwn(current, segment)) {
      current = current[segment];
    } else {
      return { resolved: false };
    }

    if (current === undefined) {
      return { resolved: false };
    }
    parentSegment = segment;
  }

  return { resolved: true };
}

export function isEditableTargetPath(document: unknown, targetPath: string): boolean {
  return (
    EDITABLE_PATH_PATTERNS.some((pattern) => pattern.test(targetPath)) &&
    resolveTargetPath(document, targetPath).resolved
  );
}

export function hasReviewForPathPrefix(
  reviewItems: readonly ReviewItem[],
  pathPrefix: string,
  severity?: ReviewSeverity,
): boolean {
  return reviewItems.some(
    (item) =>
      item.targetPath.startsWith(pathPrefix) &&
      (severity === undefined || item.severity === severity),
  );
}

export function issue(
  code: string,
  path: string,
  message: string,
  severity: ContractIssue["severity"] = "error",
): ContractIssue {
  return { code, message, path, severity };
}

export function resultFromIssues(
  issues: readonly ContractIssue[],
): ContractValidationResult {
  const sortedIssues = [...issues].sort((left, right) => {
    if (left.path !== right.path) return left.path < right.path ? -1 : 1;
    if (left.code === right.code) return 0;
    return left.code < right.code ? -1 : 1;
  });

  return {
    issues: sortedIssues,
    valid: sortedIssues.every(({ severity }) => severity !== "error"),
  };
}

type ReviewableLesson = {
  reviewItems: ReviewItem[];
  supported: boolean;
};

export function validateReviewedLesson<TLesson extends ReviewableLesson>(
  reviewed: ReviewedLesson<TLesson>,
  validateDraft: (lesson: TLesson) => ContractValidationResult,
): ContractValidationResult {
  const issues: ContractIssue[] = [...validateDraft(reviewed.draft).issues];
  const reviewIds = new Set(reviewed.draft.reviewItems.map(({ id }) => id));
  const resolvedIds = new Set(reviewed.resolvedReviewItemIds);

  if (!reviewed.draft.supported) {
    issues.push(
      issue(
        "review.unsupported",
        "/draft/supported",
        "An unsupported lesson cannot be approved for export.",
      ),
    );
  }

  for (const resolvedId of resolvedIds) {
    if (!reviewIds.has(resolvedId)) {
      issues.push(
        issue(
          "review.unknown_resolution",
          "/resolvedReviewItemIds",
          "A resolved review item ID does not exist in the draft.",
        ),
      );
    }
  }

  if (
    reviewed.draft.reviewItems.some(
      ({ id, severity }) => severity === "critical" && !resolvedIds.has(id),
    )
  ) {
    issues.push(
      issue(
        "review.critical_unresolved",
        "/resolvedReviewItemIds",
        "Every critical review item must be resolved.",
      ),
    );
  }

  if (!reviewed.reviewerAcknowledged) {
    issues.push(
      issue(
        "review.acknowledgement_required",
        "/reviewerAcknowledged",
        "Teacher acknowledgement is required.",
      ),
    );
  }

  for (const modifiedPath of reviewed.modifiedPaths) {
    if (!isEditableTargetPath(reviewed.draft, modifiedPath)) {
      issues.push(
        issue(
          "review.modified_path_invalid",
          "/modifiedPaths",
          "A modified path does not resolve to an editable draft field.",
        ),
      );
    }
  }

  return resultFromIssues(issues);
}
