import {
  CONTRACT_LIMITS,
  ID_PATTERN,
  NON_EMPTY_PLAIN_TEXT_PATTERN,
  PLAIN_TEXT_PATTERN,
  REVIEW_SEVERITIES,
  REVIEW_STATUSES,
  TARGET_PATH_PATTERN,
} from "@/lib/contracts/common";

const nullablePlainText = (maxLength: number) => ({
  anyOf: [
    {
      maxLength,
      pattern: PLAIN_TEXT_PATTERN,
      type: "string" as const,
    },
    { type: "null" as const },
  ],
});

const plainText = (maxLength: number) => ({
  maxLength,
  pattern: PLAIN_TEXT_PATTERN,
  type: "string" as const,
});

const identifier = {
  maxLength: CONTRACT_LIMITS.id,
  pattern: ID_PATTERN,
  type: "string" as const,
};

const reviewItemSchema = {
  additionalProperties: false,
  properties: {
    id: identifier,
    severity: { enum: REVIEW_SEVERITIES, type: "string" as const },
    targetPath: {
      maxLength: CONTRACT_LIMITS.targetPath,
      pattern: TARGET_PATH_PATTERN,
      type: "string" as const,
    },
    message: {
      maxLength: CONTRACT_LIMITS.reviewMessage,
      minLength: 1,
      pattern: NON_EMPTY_PLAIN_TEXT_PATTERN,
      type: "string" as const,
    },
    status: { enum: REVIEW_STATUSES, type: "string" as const },
  },
  required: ["id", "severity", "targetPath", "message", "status"],
  type: "object" as const,
};

export const chartLessonJsonSchema = {
  $id: "https://optiq.local/schemas/chart-lesson-1.0.json",
  additionalProperties: false,
  properties: {
    schemaVersion: { const: "1.0", type: "string" as const },
    supported: { type: "boolean" as const },
    unsupportedReason: nullablePlainText(CONTRACT_LIMITS.unsupportedReason),
    title: plainText(CONTRACT_LIMITS.lessonTitle),
    summary: plainText(CONTRACT_LIMITS.summary),
    chartType: {
      enum: ["bar", "line", "unknown"],
      type: "string" as const,
    },
    xAxis: {
      additionalProperties: false,
      properties: {
        label: plainText(CONTRACT_LIMITS.axisLabel),
        unit: nullablePlainText(CONTRACT_LIMITS.unit),
      },
      required: ["label", "unit"],
      type: "object" as const,
    },
    yAxis: {
      additionalProperties: false,
      properties: {
        label: plainText(CONTRACT_LIMITS.axisLabel),
        unit: nullablePlainText(CONTRACT_LIMITS.unit),
        visibleMin: {
          anyOf: [{ type: "number" as const }, { type: "null" as const }],
        },
        visibleMax: {
          anyOf: [{ type: "number" as const }, { type: "null" as const }],
        },
      },
      required: ["label", "unit", "visibleMin", "visibleMax"],
      type: "object" as const,
    },
    series: {
      items: {
        additionalProperties: false,
        properties: {
          id: identifier,
          label: plainText(CONTRACT_LIMITS.seriesLabel),
          points: {
            items: {
              additionalProperties: false,
              properties: {
                id: identifier,
                xLabel: plainText(CONTRACT_LIMITS.pointLabel),
                value: { type: "number" as const },
                displayValue: plainText(CONTRACT_LIMITS.displayValue),
                status: { enum: REVIEW_STATUSES, type: "string" as const },
              },
              required: ["id", "xLabel", "value", "displayValue", "status"],
              type: "object" as const,
            },
            maxItems: 50,
            minItems: 1,
            type: "array" as const,
          },
        },
        required: ["id", "label", "points"],
        type: "object" as const,
      },
      maxItems: 6,
      type: "array" as const,
    },
    trends: {
      items: {
        additionalProperties: false,
        properties: {
          id: identifier,
          text: plainText(CONTRACT_LIMITS.trendText),
          status: { enum: REVIEW_STATUSES, type: "string" as const },
        },
        required: ["id", "text", "status"],
        type: "object" as const,
      },
      maxItems: 8,
      type: "array" as const,
    },
    reviewItems: {
      items: reviewItemSchema,
      maxItems: CONTRACT_LIMITS.reviewItems,
      type: "array" as const,
    },
  },
  required: [
    "schemaVersion",
    "supported",
    "unsupportedReason",
    "title",
    "summary",
    "chartType",
    "xAxis",
    "yAxis",
    "series",
    "trends",
    "reviewItems",
  ],
  type: "object" as const,
} as const;

export const processLessonJsonSchema = {
  $id: "https://optiq.local/schemas/process-lesson-1.0.json",
  additionalProperties: false,
  properties: {
    schemaVersion: { const: "1.0", type: "string" as const },
    supported: { type: "boolean" as const },
    unsupportedReason: nullablePlainText(CONTRACT_LIMITS.unsupportedReason),
    title: plainText(CONTRACT_LIMITS.lessonTitle),
    summary: plainText(CONTRACT_LIMITS.summary),
    nodes: {
      items: {
        additionalProperties: false,
        properties: {
          id: identifier,
          label: plainText(CONTRACT_LIMITS.processLabel),
          description: plainText(CONTRACT_LIMITS.processDescription),
          status: { enum: REVIEW_STATUSES, type: "string" as const },
        },
        required: ["id", "label", "description", "status"],
        type: "object" as const,
      },
      maxItems: 30,
      type: "array" as const,
    },
    edges: {
      items: {
        additionalProperties: false,
        properties: {
          id: identifier,
          from: identifier,
          to: identifier,
          label: nullablePlainText(CONTRACT_LIMITS.edgeLabel),
          status: { enum: REVIEW_STATUSES, type: "string" as const },
        },
        required: ["id", "from", "to", "label", "status"],
        type: "object" as const,
      },
      maxItems: 60,
      type: "array" as const,
    },
    readingOrder: {
      items: identifier,
      maxItems: 30,
      type: "array" as const,
    },
    reviewItems: {
      items: reviewItemSchema,
      maxItems: CONTRACT_LIMITS.reviewItems,
      type: "array" as const,
    },
  },
  required: [
    "schemaVersion",
    "supported",
    "unsupportedReason",
    "title",
    "summary",
    "nodes",
    "edges",
    "readingOrder",
    "reviewItems",
  ],
  type: "object" as const,
} as const;

export const chartResponseFormat = {
  name: "optiq_chart_lesson_1_0",
  schema: chartLessonJsonSchema,
  strict: true,
  type: "json_schema" as const,
} as const;

export const processResponseFormat = {
  name: "optiq_process_lesson_1_0",
  schema: processLessonJsonSchema,
  strict: true,
  type: "json_schema" as const,
} as const;
