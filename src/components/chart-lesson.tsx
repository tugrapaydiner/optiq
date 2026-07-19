"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";

import {
  WebAudioPlayer,
  type AudioPlayer,
} from "@/lib/audio-player";
import type {
  ChartLesson,
  ChartPoint,
  ChartSeries,
} from "@/lib/contracts/chart";
import type { ReviewStatus } from "@/lib/contracts/common";
import { buildSonificationTimeline } from "@/lib/sonification";

type ChartLessonViewProps = {
  audioPlayerFactory?: () => AudioPlayer;
  headingRef?: Ref<HTMLHeadingElement>;
  lesson: ChartLesson;
  sourceLabel: string;
};

const STATUS_LABELS: Readonly<Record<ReviewStatus, string>> = {
  unclear: "Unclear",
  inferred_from_layout: "Inferred from layout",
  verified_visible_text: "Verified visible text",
};

const createWebAudioPlayer = () => new WebAudioPlayer();

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

type PlaybackState = "complete" | "error" | "idle" | "playing" | "stopped";

function PointExplorer({
  audioPlayerFactory,
  lesson,
}: {
  audioPlayerFactory: () => AudioPlayer;
  lesson: ChartLesson;
}) {
  const headingId = useId();
  const helpId = useId();
  const [seriesIndex, setSeriesIndex] = useState(0);
  const [pointIndex, setPointIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [audioAnnouncement, setAudioAnnouncement] = useState("");
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const playbackGenerationRef = useRef(0);
  const series = lesson.series[seriesIndex]!;
  const currentText = currentPointText(series, pointIndex, lesson.yAxis.unit);
  const isPlaying = playbackState === "playing";

  useEffect(
    () => () => {
      playbackGenerationRef.current += 1;
      audioPlayerRef.current?.dispose();
      audioPlayerRef.current = null;
    },
    [],
  );

  function stopPlayback(): void {
    const wasPlaying = playbackState === "playing";
    playbackGenerationRef.current += 1;
    audioPlayerRef.current?.stop();
    if (wasPlaying) {
      setPlaybackState("stopped");
      setAudioAnnouncement("Playback stopped.");
      playButtonRef.current?.focus();
    }
  }

  async function playSeries(): Promise<void> {
    const isRestart = playbackState === "playing";
    const player = audioPlayerRef.current ?? audioPlayerFactory();
    audioPlayerRef.current = player;
    playbackGenerationRef.current += 1;
    const generation = playbackGenerationRef.current;
    player.stop();
    setPointIndex(0);
    setPlaybackState("playing");
    setAudioAnnouncement(
      `Playback ${isRestart ? "restarted" : "started"} for ${series.label}.`,
    );

    try {
      await player.play(
        buildSonificationTimeline(series.points.map(({ value }) => value)),
        {
          onComplete: () => {
            if (generation !== playbackGenerationRef.current) return;
            setPlaybackState("complete");
            setAudioAnnouncement(`Playback complete for ${series.label}.`);
          },
          onPoint: (nextPointIndex) => {
            if (generation !== playbackGenerationRef.current) return;
            setPointIndex(nextPointIndex);
          },
        },
      );
    } catch {
      if (generation !== playbackGenerationRef.current) return;
      player.stop();
      setPlaybackState("error");
      setAudioAnnouncement(
        "Audio could not start in this browser. Exact values remain available in the table.",
      );
    }
  }

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
    playbackGenerationRef.current += 1;
    audioPlayerRef.current?.stop();
    setPlaybackState("idle");
    setAudioAnnouncement("");
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
        data-playback-active={isPlaying ? "true" : "false"}
        onKeyDown={onExplorerKeyDown}
        tabIndex={0}
      >
        <div>
          {isPlaying ? <span className="audio-current-marker">Sounding now</span> : null}
          <p>{currentText}</p>
        </div>
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

      <div className="sonification-controls">
        <div className="sonification-copy">
          <p className="chart-section-label">Optional sound</p>
          <p>
            Lower values use lower pitches; higher values use higher pitches.
            Exact values stay available above.
          </p>
        </div>
        <div className="sonification-actions">
          <button
            aria-label={isPlaying ? "Restart series" : "Play series"}
            className="button button-primary"
            onClick={() => void playSeries()}
            ref={playButtonRef}
            type="button"
          >
            {isPlaying ? "Restart series" : "Play series"}
          </button>
          <button
            className="button button-secondary"
            disabled={!isPlaying}
            onClick={stopPlayback}
            type="button"
          >
            Stop
          </button>
        </div>
        <p className="sonification-status" data-testid="sonification-status">
          {playbackState === "playing"
            ? `Playing ${series.label} — point ${pointIndex + 1} of ${series.points.length}.`
            : playbackState === "complete"
              ? `Playback complete for ${series.label}.`
              : playbackState === "stopped"
                ? "Playback stopped."
                : playbackState === "error"
                  ? "Audio unavailable. Exact values remain available."
                  : `Ready to play ${series.label}.`}
        </p>
      </div>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="visually-hidden"
        data-testid="point-announcement"
      >
        {announcement}
      </p>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="visually-hidden"
        data-testid="audio-announcement"
      >
        {audioAnnouncement}
      </p>
    </section>
  );
}

function playbackLessonKey(lesson: ChartLesson): string {
  return lesson.series
    .map(
      (series) =>
        `${series.id}:${series.points.map((point) => `${point.id}:${point.value}`).join(",")}`,
    )
    .join("|");
}

export function ChartLessonView({
  audioPlayerFactory = createWebAudioPlayer,
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

      <PointExplorer
        audioPlayerFactory={audioPlayerFactory}
        key={playbackLessonKey(lesson)}
        lesson={lesson}
      />
      <p className="analysis-review-note">
        Draft only. Teacher review comes next.
      </p>
    </figure>
  );
}
