import type { ReviewItem, ReviewStatus } from "./common";

export const CHART_TYPES = ["bar", "line", "unknown"] as const;

export type ChartType = (typeof CHART_TYPES)[number];

export type ChartAxis = {
  label: string;
  unit: string | null;
};

export type ChartValueAxis = ChartAxis & {
  visibleMax: number | null;
  visibleMin: number | null;
};

export type ChartPoint = {
  id: string;
  xLabel: string;
  value: number;
  displayValue: string;
  status: ReviewStatus;
};

export type ChartSeries = {
  id: string;
  label: string;
  points: ChartPoint[];
};

export type ChartTrend = {
  id: string;
  text: string;
  status: ReviewStatus;
};

export type ChartLesson = {
  schemaVersion: "1.0";
  supported: boolean;
  unsupportedReason: string | null;
  title: string;
  summary: string;
  chartType: ChartType;
  xAxis: ChartAxis;
  yAxis: ChartValueAxis;
  series: ChartSeries[];
  trends: ChartTrend[];
  reviewItems: ReviewItem[];
};
