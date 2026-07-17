"use client";

import { useId, useState, type KeyboardEvent, type Ref } from "react";

import type {
  ChartLesson,
  ChartPoint,
  ChartSeries,
} from "@/lib/contracts/chart";
import type { ReviewStatus } from "@/lib/contracts/common";

type ChartLessonViewProps = {
  headingRef?: Ref<HTMLHeadingElement>;
  lesson: ChartLesson;
  sourceLabel: string;
};

const STATUS_LABELS: Readonly<Record<ReviewStatus, string>> = {
  unclear: "Unclear",
  inferred_from_layout: "Inferred from layout",
  verified_visible_text: "Verified visible text",
};

function includesUnit(value: string, unit: string): boolean {
  return value.toLocaleLowerCase().includes(unit.toLocaleLowerCase());
}

export function formatChartValue(point: ChartPoint, unit: string | null): string {
  const displayValue = point.displayValue.trim();
  if (!unit || includesUnit(displayValue, unit)) return displayValue;
  return `${displayValue} ${unit}`;
}

function axisLabel(label: string, unit: string | null): string {
  return unit ? `${label} (${unit})` : label;
}

function statusCounts(lesson: ChartLesson): Record<ReviewStatus, number> {
  const counts: Record<ReviewStatus, number> = {
    unclear: 0,
    inferred_from_layout: 0,
    verified_visible_text: 0,
  };
  lesson.series.forEach((series) => {
    series.points.forEach((point) => {
      counts[point.status] += 1;
    });
  });
  return counts;
}

function PointStatus({ status }: { status: ReviewStatus }) {
  if (status === "verified_visible_text") return null;
  return <span className={`evidence-tag evidence-tag-${status}`}>{STATUS_LABELS[status]}</span>;
}

function currentPointText(
  series: ChartSeries,
  pointIndex: number,
  unit: string | null,
): string {
  const point = series.points[pointIndex]!;
  return `${series.label} — ${point.xLabel} — ${formatChartValue(point, unit)} — point ${pointIndex + 1} of ${series.points.length}`;
}

function PointExplorer({ lesson }: { lesson: ChartLesson }) {
  const headingId = useId();
  const helpId = useId();
  const [seriesIndex, setSeriesIndex] = useState(0);
  const [pointIndex, setPointIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const series = lesson.series[seriesIndex]!;
  const currentText = currentPointText(series, pointIndex, lesson.yAxis.unit);

  function selectPoint(nextPointIndex: number): void {
    if (nextPointIndex < 0 || nextPointIndex >= series.points.length) return;
    setPointIndex(nextPointIndex);
    setAnnouncement(
      currentPointText(series, nextPointIndex, lesson.yAxis.unit),
    );
  }

  function selectSeries(nextSeriesIndex: number): void {
    const nextSeries = lesson.series[nextSeriesIndex];
    if (!nextSeries) return;
    setSeriesIndex(nextSeriesIndex);
    setPointIndex(0);
    setAnnouncement(currentPointText(nextSeries, 0, lesson.yAxis.unit));
  }

  function onExplorerKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    selectPoint(pointIndex + (event.key === "ArrowLeft" ? -1 : 1));
  }

  return (
    <section aria-labelledby={headingId} className="point-explorer">
      <div className="point-explorer-heading">
        <div>
          <p className="chart-section-label">Keyboard explorer</p>
          <h3 id={headingId}>Explore one value at a time</h3>
        </div>
        {lesson.series.length > 1 ? (
          <label className="series-selector">
            <span>Series</span>
            <select
              onChange={(event) => selectSeries(Number(event.target.value))}
              value={seriesIndex}
            >
              {lesson.series.map((option, index) => (
                <option key={option.id} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="single-series-label">Series: {series.label}</p>
        )}
      </div>

      <div
        aria-describedby={helpId}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        className="point-readout"
        onKeyDown={onExplorerKeyDown}
        tabIndex={0}
      >
        <p>{currentText}</p>
        <PointStatus status={series.points[pointIndex]!.status} />
      </div>

      <div className="point-controls">
        <button
          className="button button-secondary"
          disabled={pointIndex === 0}
          onClick={() => selectPoint(pointIndex - 1)}
          type="button"
        >
          Previous point
        </button>
        <button
          className="button button-secondary"
          disabled={pointIndex === series.points.length - 1}
          onClick={() => selectPoint(pointIndex + 1)}
          type="button"
        >
          Next point
        </button>
      </div>
      <p className="explorer-help" id={helpId}>
        When the current point is focused, use Left and Right Arrow. Navigation
        stops at the first and last point.
      </p>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="visually-hidden"
        data-testid="point-announcement"
      >
        {announcement}
      </p>
    </section>
  );
}

export function ChartLessonView({
  headingRef,
  lesson,
  sourceLabel,
}: ChartLessonViewProps) {
  if (!lesson.supported || lesson.series.length === 0) return null;

  const xLabels = lesson.series[0]!.points.map(({ xLabel }) => xLabel);
  const counts = statusCounts(lesson);
  const totalValues = lesson.series.reduce(
    (total, series) => total + series.points.length,
    0,
  );
  const range =
    lesson.yAxis.visibleMin !== null && lesson.yAxis.visibleMax !== null
      ? `${lesson.yAxis.visibleMin} to ${lesson.yAxis.visibleMax}${lesson.yAxis.unit ? ` ${lesson.yAxis.unit}` : ""}`
      : "Not specified";

  return (
    <figure className="chart-lesson">
      <figcaption className="chart-lesson-intro">
        <p className="analysis-message-label">{sourceLabel}</p>
        <h2 ref={headingRef} tabIndex={-1}>
          {lesson.title}
        </h2>
        <p className="chart-summary">{lesson.summary}</p>
      </figcaption>

      <dl className="chart-context">
        <div>
          <dt>Chart type</dt>
          <dd>{lesson.chartType === "bar" ? "Bar chart" : "Line chart"}</dd>
        </div>
        <div>
          <dt>X-axis</dt>
          <dd>{axisLabel(lesson.xAxis.label, lesson.xAxis.unit)}</dd>
        </div>
        <div>
          <dt>Y-axis</dt>
          <dd>{axisLabel(lesson.yAxis.label, lesson.yAxis.unit)}</dd>
        </div>
        <div>
          <dt>Visible range</dt>
          <dd>{range}</dd>
        </div>
      </dl>

      <p className="chart-evidence-summary">
        {totalValues} exact {totalValues === 1 ? "value" : "values"}: {counts.verified_visible_text} verified, {counts.inferred_from_layout} inferred, {counts.unclear} unclear. {lesson.reviewItems.length} {lesson.reviewItems.length === 1 ? "item" : "items"} flagged for teacher review.
      </p>

      <section aria-labelledby="chart-values-heading" className="chart-values">
        <div className="chart-section-heading">
          <p className="chart-section-label">Exact data</p>
          <h3 id="chart-values-heading">Values and units</h3>
        </div>
        <div
          aria-label="Exact chart values; scroll horizontally when needed"
          className="chart-table-scroll"
          role="region"
          tabIndex={0}
        >
          <table>
            <caption>{lesson.title} — exact values</caption>
            <thead>
              <tr>
                <th scope="col">{axisLabel(lesson.xAxis.label, lesson.xAxis.unit)}</th>
                {lesson.series.map((series) => (
                  <th key={series.id} scope="col">
                    {axisLabel(series.label, lesson.yAxis.unit)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {xLabels.map((xLabel, pointIndex) => (
                <tr key={`${xLabel}-${pointIndex}`}>
                  <th scope="row">{xLabel}</th>
                  {lesson.series.map((series) => {
                    const point = series.points[pointIndex]!;
                    return (
                      <td key={point.id}>
                        <span>{formatChartValue(point, lesson.yAxis.unit)}</span>
                        <PointStatus status={point.status} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {lesson.trends.length > 0 ? (
        <section aria-labelledby="chart-trends-heading" className="chart-trends">
          <div className="chart-section-heading">
            <p className="chart-section-label">Visible patterns</p>
            <h3 id="chart-trends-heading">Trends from the extracted values</h3>
          </div>
          <ul>
            {lesson.trends.map((trend) => (
              <li key={trend.id}>
                <span>{trend.text}</span>
                <span className="trend-status">{STATUS_LABELS[trend.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PointExplorer lesson={lesson} />
      <p className="analysis-review-note">
        Draft only. Teacher review comes next.
      </p>
    </figure>
  );
}
