import type { ChartLesson } from "@/lib/contracts/chart";
import type { ProcessLesson } from "@/lib/contracts/process";

export function makeChartLesson(): ChartLesson {
  return {
    schemaVersion: "1.0",
    supported: true,
    unsupportedReason: null,
    title: "Monthly library visits",
    summary: "Visits increase overall.",
    chartType: "bar",
    xAxis: { label: "Month", unit: null },
    yAxis: { label: "Visits", unit: "visits", visibleMin: 0, visibleMax: 200 },
    series: [
      {
        id: "visits",
        label: "Visits",
        points: [
          {
            id: "jan",
            xLabel: "Jan",
            value: 120,
            displayValue: "120",
            status: "verified_visible_text",
          },
          {
            id: "feb",
            xLabel: "Feb",
            value: 165,
            displayValue: "165",
            status: "verified_visible_text",
          },
        ],
      },
    ],
    trends: [
      {
        id: "overall-rise",
        text: "Visits rise overall.",
        status: "verified_visible_text",
      },
    ],
    reviewItems: [],
  };
}

export function makeUnsupportedChartLesson(): ChartLesson {
  return {
    ...makeChartLesson(),
    supported: false,
    unsupportedReason: "The image is not a supported chart.",
    chartType: "unknown",
    series: [],
    trends: [],
  };
}

export function makeProcessLesson(): ProcessLesson {
  return {
    schemaVersion: "1.0",
    supported: true,
    unsupportedReason: null,
    title: "Simple process",
    summary: "The start leads to the finish.",
    nodes: [
      {
        id: "start",
        label: "Start",
        description: "The process begins.",
        status: "verified_visible_text",
      },
      {
        id: "finish",
        label: "Finish",
        description: "The process ends.",
        status: "verified_visible_text",
      },
    ],
    edges: [
      {
        id: "start-to-finish",
        from: "start",
        to: "finish",
        label: null,
        status: "inferred_from_layout",
      },
    ],
    readingOrder: ["start", "finish"],
    reviewItems: [],
  };
}

export function makeUnsupportedProcessLesson(): ProcessLesson {
  return {
    ...makeProcessLesson(),
    supported: false,
    unsupportedReason: "The image is not a supported process diagram.",
    nodes: [],
    edges: [],
    readingOrder: [],
  };
}
