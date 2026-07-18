import chartBarOne from "../../../fixtures/gold/chart-bar-01.json";
import chartBarTwo from "../../../fixtures/gold/chart-bar-02.json";
import chartLineOne from "../../../fixtures/gold/chart-line-01.json";
import chartLineTwo from "../../../fixtures/gold/chart-line-02.json";

import type { ChartLesson } from "../contracts/chart";

const reviewBase = chartBarOne as ChartLesson;
const chartReviewLesson: ChartLesson = {
  ...reviewBase,
  reviewItems: [
    {
      id: "review-march-value",
      message:
        "The March bar label is unclear. Confirm the exact numeric value.",
      severity: "critical",
      status: "unclear",
      targetPath:
        "/series/chart-bar-01-visits/points/chart-bar-01-visits-3/value",
    },
  ],
  series: reviewBase.series.map((series) => ({
    ...series,
    points: series.points.map((point) =>
      point.id === "chart-bar-01-visits-3"
        ? { ...point, status: "unclear" }
        : { ...point },
    ),
  })),
  trends: reviewBase.trends.map((trend) => ({ ...trend })),
};

export type ChartSample = {
  description: string;
  id: string;
  label: string;
  lesson: ChartLesson;
};

export const CHART_SAMPLES: readonly ChartSample[] = [
  {
    description: "Two series across four light conditions",
    id: "chart-bar-02",
    label: "Plant height by light condition",
    lesson: chartBarTwo as ChartLesson,
  },
  {
    description: "One series across five months",
    id: "chart-bar-01",
    label: "Monthly library visits",
    lesson: chartBarOne as ChartLesson,
  },
  {
    description: "A line series with negative values",
    id: "chart-line-01",
    label: "Morning temperature",
    lesson: chartLineOne as ChartLesson,
  },
  {
    description: "Two line series across study weeks",
    id: "chart-line-02",
    label: "Quiz scores by study method",
    lesson: chartLineTwo as ChartLesson,
  },
  {
    description: "One unclear value for teacher review",
    id: "chart-review-01",
    label: "Library visits review example",
    lesson: chartReviewLesson,
  },
] as const;

export function getChartSample(sampleId: string): ChartSample {
  return CHART_SAMPLES.find(({ id }) => id === sampleId) ?? CHART_SAMPLES[0]!;
}
