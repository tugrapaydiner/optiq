import packageMetadata from "../../../package.json";

import type {
  ChartLesson,
  ChartPoint,
} from "@/lib/contracts/chart";
import type { ReviewStatus } from "@/lib/contracts/common";
import type {
  ProcessEdge,
  ProcessLesson,
} from "@/lib/contracts/process";
import {
  exportEligibility,
  type ReviewLesson,
  type ReviewMode,
  type TeacherReviewState,
} from "@/lib/review/state";

import { escapeHtml, safeExportFilename } from "./sanitize";

export const OPTIQ_EXPORT_VERSION = packageMetadata.version;
export const STANDALONE_EXPORT_MIME = "text/html;charset=utf-8";

export type StandaloneExportArtifact = {
  filename: string;
  html: string;
  mimeType: typeof STANDALONE_EXPORT_MIME;
};

export class ExportBlockedError extends Error {
  readonly reasons: readonly string[];

  constructor(reasons: readonly string[]) {
    super(`Standalone export is blocked: ${reasons.join(" ")}`);
    this.name = "ExportBlockedError";
    this.reasons = [...reasons];
  }
}

const STATUS_LABELS: Readonly<Record<ReviewStatus, string>> = {
  unclear: "Unclear",
  inferred_from_layout: "Inferred from layout",
  verified_visible_text: "Verified visible text",
};

const STANDALONE_CSS = String.raw`
:root {
  color-scheme: light;
  --background: #f3efe6;
  --surface: #fffdf8;
  --ink: #11120f;
  --ink-soft: #3f403a;
  --muted: #6d6c66;
  --line: #c9c5bc;
  --accent: #315961;
  --accent-soft: #dbe6e4;
  --button: #2e2309;
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  color: var(--ink);
  background: var(--background);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 1rem;
  line-height: 1.55;
}

.skip-link {
  position: fixed;
  z-index: 10;
  top: 0.75rem;
  left: 0.75rem;
  min-height: 44px;
  padding: 0.65rem 0.9rem;
  color: white;
  background: var(--button);
  transform: translateY(-160%);
}

.skip-link:focus { transform: translateY(0); }

a { color: var(--accent); text-underline-offset: 0.2em; }

:focus-visible {
  outline: 3px solid #0f6f83;
  outline-offset: 3px;
}

main,
footer {
  width: min(72rem, calc(100% - 2rem));
  margin-inline: auto;
}

main {
  margin-block: clamp(2rem, 6vw, 5rem);
  padding: clamp(1.25rem, 4vw, 3.5rem);
  background: var(--surface);
  border-radius: 1rem;
}

.eyebrow {
  margin: 0 0 0.45rem;
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

h1,
h2,
h3 { line-height: 1.12; letter-spacing: -0.025em; }

h1 {
  max-width: 52rem;
  margin: 0;
  font-size: clamp(2.25rem, 7vw, 4.75rem);
}

h2 { margin: 0; font-size: clamp(1.45rem, 3vw, 2rem); }
h3 { margin: 0; font-size: 1.15rem; }

.summary {
  max-width: 48rem;
  margin: 1rem 0 0;
  color: var(--ink-soft);
  font-size: clamp(1rem, 2vw, 1.2rem);
}

.lesson-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.8rem;
  margin: 2rem 0 0;
}

.lesson-meta > div {
  min-width: 0;
  padding-top: 0.7rem;
  border-top: 1px solid var(--line);
}

.lesson-meta dt { color: var(--muted); font-size: 0.8rem; }
.lesson-meta dd { margin: 0.25rem 0 0; font-weight: 700; overflow-wrap: anywhere; }

.lesson-section {
  margin-top: clamp(2.25rem, 6vw, 4.5rem);
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
}

.section-intro { max-width: 48rem; margin: 0.6rem 0 1.25rem; color: var(--ink-soft); }

.table-scroll {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
}

table { width: 100%; min-width: 32rem; border-collapse: collapse; background: white; }
caption { padding: 1rem; font-weight: 700; text-align: left; }
th,
td { padding: 0.75rem 0.9rem; border-top: 1px solid var(--line); text-align: left; vertical-align: top; }
thead th { background: #ece8df; }
tbody th { background: #f8f5ee; }

.provenance {
  display: block;
  margin-top: 0.25rem;
  color: var(--muted);
  font-size: 0.75rem;
}

.trend-list,
.process-order,
.connections { padding-left: 1.35rem; }
.trend-list li + li,
.connections li + li { margin-top: 0.6rem; }

.process-order > li { padding-left: 0.45rem; }
.process-order > li + li { margin-top: 1.5rem; }

.process-node {
  padding: 1.15rem;
  background: #f8f5ee;
  border-left: 3px solid var(--accent);
  border-radius: 0.6rem;
}

.process-node p { margin: 0.55rem 0 0; }
.connections { margin: 0.75rem 0 0; }
.connection-empty { color: var(--muted); }

.enhancement {
  margin-top: clamp(2.25rem, 6vw, 4.5rem);
  padding: clamp(1rem, 3vw, 1.5rem);
  background: var(--accent-soft);
  border-radius: 0.75rem;
}

.enhancement[hidden] { display: none; }

.enhancement-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
}

label { display: grid; gap: 0.3rem; font-size: 0.82rem; font-weight: 700; }

select,
button {
  min-height: 44px;
  padding: 0.65rem 0.85rem;
  border: 1px solid #8f8c84;
  border-radius: 0.45rem;
  font: inherit;
}

select { color: var(--ink); background: white; }
button { color: white; background: var(--button); cursor: pointer; }
button.secondary { color: var(--ink); background: white; }
button:disabled { cursor: not-allowed; opacity: 0.55; }

.point-readout {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-left: 4px solid var(--accent);
  border-radius: 0.5rem;
  font-weight: 700;
}

.controls { display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: 0.85rem; }
.help,
.audio-copy,
.audio-status { color: var(--ink-soft); }
.audio-block { margin-top: 1.4rem; padding-top: 1rem; border-top: 1px solid #9fb3af; }
.audio-status { margin: 0.75rem 0 0; }

.review-note {
  margin-top: 2.5rem;
  padding: 1rem;
  background: #ece8df;
  border-radius: 0.6rem;
}

footer {
  margin-block: 0 3rem;
  padding-top: 1.25rem;
  color: var(--ink-soft);
  border-top: 1px solid var(--line);
}

footer p { margin: 0.3rem 0; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 48rem) {
  .lesson-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 30rem) {
  main,
  footer { width: min(100% - 1rem, 72rem); }
  main { padding: 1rem; border-radius: 0.75rem; }
  .lesson-meta { grid-template-columns: minmax(0, 1fr); }
  .controls > * { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}

@media print {
  body { background: white; font-size: 11pt; }
  main,
  footer { width: 100%; margin: 0; padding: 0; }
  main { border-radius: 0; }
  .skip-link,
  .enhancement { display: none !important; }
  .table-scroll { overflow: visible; border: 0; }
  table { min-width: 0; }
  .process-node { break-inside: avoid; }
  a { color: inherit; text-decoration: none; }
}
`;

const CHART_ENHANCEMENT_SCRIPT = String.raw`
(() => {
  "use strict";

  const root = document.querySelector("[data-chart-enhancement]");
  const table = document.querySelector("[data-chart-table]");
  if (!root || !table) return;

  const seriesHeaders = Array.from(table.querySelectorAll("[data-series-header]"));
  const rows = Array.from(table.querySelectorAll("tbody tr[data-point-index]"));
  const series = seriesHeaders.map((header, seriesIndex) => ({
    label: (header.querySelector("[data-series-name]")?.textContent || "Series").trim(),
    points: rows.map((row) => {
      const cell = row.querySelector('[data-series-index="' + seriesIndex + '"]');
      return {
        displayValue: (cell?.querySelector("[data-display-value]")?.textContent || "").trim(),
        value: Number(cell?.getAttribute("data-value")),
        xLabel: (row.querySelector("[data-x-label]")?.textContent || "").trim(),
      };
    }),
  }));
  if (series.length === 0 || series.some((item) => item.points.length === 0)) return;

  const seriesSelect = root.querySelector("[data-series-select]");
  const readout = root.querySelector("[data-point-readout]");
  const previous = root.querySelector("[data-previous-point]");
  const next = root.querySelector("[data-next-point]");
  const pointAnnouncement = root.querySelector("[data-point-announcement]");
  const play = root.querySelector("[data-play-series]");
  const stop = root.querySelector("[data-stop-series]");
  const audioStatus = root.querySelector("[data-audio-status]");
  const audioAnnouncement = root.querySelector("[data-audio-announcement]");
  if (!readout || !previous || !next || !play || !stop || !audioStatus) return;

  let seriesIndex = 0;
  let pointIndex = 0;
  let playing = false;
  let audioContext = null;
  let generation = 0;
  let timers = [];
  let nodes = [];

  function currentSeries() {
    return series[seriesIndex];
  }

  function pointText() {
    const selectedSeries = currentSeries();
    const point = selectedSeries.points[pointIndex];
    return selectedSeries.label + " — " + point.xLabel + " — " + point.displayValue +
      " — point " + (pointIndex + 1) + " of " + selectedSeries.points.length;
  }

  function renderPoint(announce) {
    readout.textContent = pointText();
    previous.disabled = pointIndex === 0;
    next.disabled = pointIndex === currentSeries().points.length - 1;
    if (announce && pointAnnouncement) pointAnnouncement.textContent = pointText();
  }

  function setPlaying(nextPlaying) {
    playing = nextPlaying;
    stop.disabled = !playing;
    play.textContent = playing ? "Restart series" : "Play series";
    play.setAttribute("aria-label", playing ? "Restart series" : "Play series");
  }

  function clearPlayback(closeContext) {
    generation += 1;
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
    nodes.forEach(({ gain, oscillator }) => {
      oscillator.onended = null;
      try { oscillator.stop(); } catch {}
      oscillator.disconnect();
      gain.disconnect();
    });
    nodes = [];
    setPlaying(false);
    if (closeContext && audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
      audioContext = null;
    }
  }

  function stopPlayback(announce) {
    const wasPlaying = playing;
    clearPlayback(false);
    if (wasPlaying) {
      audioStatus.textContent = "Playback stopped.";
      if (announce && audioAnnouncement) {
        audioAnnouncement.textContent = "Playback stopped.";
      }
    }
  }

  function scheduleTone(context, baseTime, point, min, max, index) {
    const normalized = min === max ? 0.5 : Math.max(0, Math.min(1, (point.value - min) / (max - min)));
    const midi = 48 + normalized * 36;
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    const startTime = baseTime + index * 0.33;
    const endTime = startTime + 0.25;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.06, startTime + 0.01);
    gain.gain.setValueAtTime(0.06, endTime - 0.03);
    gain.gain.linearRampToValueAtTime(0, endTime);
    oscillator.connect(gain);
    gain.connect(context.destination);
    const scheduled = { gain, oscillator };
    nodes.push(scheduled);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      nodes = nodes.filter((node) => node !== scheduled);
    };
    oscillator.start(startTime);
    oscillator.stop(endTime);
  }

  async function playSeries() {
    const restart = playing;
    clearPlayback(false);
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      audioStatus.textContent = "Audio is unavailable. Exact values remain in the table.";
      if (audioAnnouncement) audioAnnouncement.textContent = audioStatus.textContent;
      return;
    }
    try {
      audioContext = audioContext || new Context();
      if (audioContext.state === "suspended") await audioContext.resume();
      const selectedSeries = currentSeries();
      const values = selectedSeries.points.map((point) => point.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const activeGeneration = ++generation;
      const baseTime = audioContext.currentTime + 0.02;
      pointIndex = 0;
      renderPoint(false);
      setPlaying(true);
      audioStatus.textContent = "Playing " + selectedSeries.label + " — point 1 of " + selectedSeries.points.length + ".";
      if (audioAnnouncement) {
        audioAnnouncement.textContent = "Playback " + (restart ? "restarted" : "started") + " for " + selectedSeries.label + ".";
      }
      selectedSeries.points.forEach((point, index) => {
        scheduleTone(audioContext, baseTime, point, min, max, index);
        timers.push(window.setTimeout(() => {
          if (generation !== activeGeneration) return;
          pointIndex = index;
          renderPoint(false);
          audioStatus.textContent = "Playing " + selectedSeries.label + " — point " + (index + 1) + " of " + selectedSeries.points.length + ".";
        }, index * 330));
      });
      timers.push(window.setTimeout(() => {
        if (generation !== activeGeneration) return;
        nodes = [];
        setPlaying(false);
        audioStatus.textContent = "Playback complete for " + selectedSeries.label + ".";
        if (audioAnnouncement) audioAnnouncement.textContent = audioStatus.textContent;
      }, (selectedSeries.points.length - 1) * 330 + 250));
    } catch {
      clearPlayback(false);
      audioStatus.textContent = "Audio could not start. Exact values remain in the table.";
      if (audioAnnouncement) audioAnnouncement.textContent = audioStatus.textContent;
    }
  }

  function selectPoint(nextIndex, announce) {
    if (nextIndex < 0 || nextIndex >= currentSeries().points.length) return;
    pointIndex = nextIndex;
    renderPoint(announce);
  }

  if (seriesSelect) {
    seriesSelect.addEventListener("change", () => {
      stopPlayback(false);
      seriesIndex = Number(seriesSelect.value);
      pointIndex = 0;
      renderPoint(true);
      audioStatus.textContent = "Ready to play " + currentSeries().label + ".";
      if (audioAnnouncement) audioAnnouncement.textContent = "";
    });
  }
  previous.addEventListener("click", () => selectPoint(pointIndex - 1, true));
  next.addEventListener("click", () => selectPoint(pointIndex + 1, true));
  readout.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    selectPoint(pointIndex + (event.key === "ArrowLeft" ? -1 : 1), true);
  });
  play.addEventListener("click", () => void playSeries());
  stop.addEventListener("click", () => stopPlayback(true));
  window.addEventListener("pagehide", () => clearPlayback(true), { once: true });

  root.hidden = false;
  renderPoint(false);
  audioStatus.textContent = "Ready to play " + currentSeries().label + ".";
})();
`;

function axisLabel(label: string, unit: string | null): string {
  return unit ? `${label} (${unit})` : label;
}

function includesUnit(value: string, unit: string): boolean {
  return value.toLocaleLowerCase().includes(unit.toLocaleLowerCase());
}

function formatChartValue(point: ChartPoint, unit: string | null): string {
  const displayValue = point.displayValue.trim();
  if (!unit || includesUnit(displayValue, unit)) return displayValue;
  return `${displayValue} ${unit}`;
}

function renderMetadata(items: readonly [string, string][]): string {
  return `<dl class="lesson-meta">${items
    .map(
      ([term, definition]) =>
        `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(definition)}</dd></div>`,
    )
    .join("")}</dl>`;
}

function renderChartTable(lesson: ChartLesson): string {
  const xLabels = lesson.series[0]!.points.map(({ xLabel }) => xLabel);
  const headers = lesson.series
    .map(
      (series, seriesIndex) =>
        `<th data-series-header data-series-index="${seriesIndex}" scope="col"><span data-series-name>${escapeHtml(series.label)}</span>${lesson.yAxis.unit ? ` <span>(${escapeHtml(lesson.yAxis.unit)})</span>` : ""}</th>`,
    )
    .join("");
  const rows = xLabels
    .map((xLabel, pointIndex) => {
      const cells = lesson.series
        .map((series, seriesIndex) => {
          const point = series.points[pointIndex]!;
          return `<td data-series-index="${seriesIndex}" data-value="${point.value}"><span data-display-value>${escapeHtml(formatChartValue(point, lesson.yAxis.unit))}</span><span class="provenance">Value provenance: ${escapeHtml(STATUS_LABELS[point.status])}</span></td>`;
        })
        .join("");
      return `<tr data-point-index="${pointIndex}"><th scope="row"><span data-x-label>${escapeHtml(xLabel)}</span></th>${cells}</tr>`;
    })
    .join("");

  return `<div class="table-scroll" role="region" aria-label="Exact chart values; scroll horizontally when needed" tabindex="0"><table data-chart-table><caption>${escapeHtml(lesson.title)} — exact reviewed values</caption><thead><tr><th scope="col">${escapeHtml(axisLabel(lesson.xAxis.label, lesson.xAxis.unit))}</th>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderChartEnhancement(lesson: ChartLesson): string {
  const options = lesson.series
    .map(
      (series, index) =>
        `<option value="${index}">${escapeHtml(series.label)}</option>`,
    )
    .join("");
  const selector =
    lesson.series.length > 1
      ? `<label><span>Series</span><select data-series-select>${options}</select></label>`
      : `<p>Series: ${escapeHtml(lesson.series[0]!.label)}</p>`;

  return `<section class="enhancement" data-chart-enhancement hidden aria-labelledby="explorer-heading"><div class="enhancement-heading"><div><p class="eyebrow">Optional enhancement</p><h2 id="explorer-heading">Explore one value at a time</h2></div>${selector}</div><div class="point-readout" data-point-readout tabindex="0" aria-describedby="explorer-help" aria-keyshortcuts="ArrowLeft ArrowRight"></div><div class="controls"><button class="secondary" data-previous-point type="button">Previous point</button><button class="secondary" data-next-point type="button">Next point</button></div><p class="help" id="explorer-help">When the current value is focused, use Left and Right Arrow. Navigation stops at the first and last value.</p><div class="audio-block"><h3>Optional sound</h3><p class="audio-copy">Lower values use lower pitches; higher values use higher pitches. Exact reviewed values remain in the table.</p><div class="controls"><button data-play-series type="button">Play series</button><button class="secondary" data-stop-series disabled type="button">Stop</button></div><p class="audio-status" data-audio-status></p></div><p class="sr-only" data-point-announcement aria-live="polite" aria-atomic="true"></p><p class="sr-only" data-audio-announcement aria-live="polite" aria-atomic="true"></p></section>`;
}

function renderChartLesson(lesson: ChartLesson): string {
  const range =
    lesson.yAxis.visibleMin !== null && lesson.yAxis.visibleMax !== null
      ? `${lesson.yAxis.visibleMin} to ${lesson.yAxis.visibleMax}${lesson.yAxis.unit ? ` ${lesson.yAxis.unit}` : ""}`
      : "Not specified";
  const trends =
    lesson.trends.length > 0
      ? `<section class="lesson-section" aria-labelledby="trends-heading"><h2 id="trends-heading">Reviewed trends</h2><ul class="trend-list">${lesson.trends
          .map(
            (trend) =>
              `<li>${escapeHtml(trend.text)}<span class="provenance">Trend provenance: ${escapeHtml(STATUS_LABELS[trend.status])}</span></li>`,
          )
          .join("")}</ul></section>`
      : "";

  return `<p class="eyebrow">Standalone chart lesson</p><h1>${escapeHtml(lesson.title)}</h1><p class="summary">${escapeHtml(lesson.summary)}</p>${renderMetadata([
    ["Chart type", lesson.chartType === "bar" ? "Bar chart" : "Line chart"],
    ["Horizontal axis", axisLabel(lesson.xAxis.label, lesson.xAxis.unit)],
    ["Vertical axis", axisLabel(lesson.yAxis.label, lesson.yAxis.unit)],
    ["Visible range", range],
  ])}<section class="lesson-section" aria-labelledby="values-heading"><h2 id="values-heading">Exact reviewed values</h2><p class="section-intro">The native table is the authoritative representation. Every value remains available without sound or JavaScript.</p>${renderChartTable(lesson)}</section>${trends}${renderChartEnhancement(lesson)}`;
}

function renderConnections(
  edges: readonly ProcessEdge[],
  lesson: ProcessLesson,
): string {
  if (edges.length === 0) {
    return `<p class="connection-empty">No outgoing connections. This is an end point in the directed process.</p>`;
  }
  const nodeById = new Map(lesson.nodes.map((node) => [node.id, node]));
  return `<ul class="connections">${edges
    .map((edge) => {
      const target = nodeById.get(edge.to)!;
      return `<li><a href="#node-${escapeHtml(target.id)}">Connects to: ${escapeHtml(target.label)}</a>${edge.label ? ` — ${escapeHtml(edge.label)}` : ""}<span class="provenance">Connection provenance: ${escapeHtml(STATUS_LABELS[edge.status])}</span></li>`;
    })
    .join("")}</ul>`;
}

function renderProcessLesson(lesson: ProcessLesson): string {
  const nodeById = new Map(lesson.nodes.map((node) => [node.id, node]));
  const orderedNodes = lesson.readingOrder.map((nodeId) => nodeById.get(nodeId)!);
  const nodes = orderedNodes
    .map((node, index) => {
      const outgoing = lesson.edges.filter(({ from }) => from === node.id);
      return `<li><article class="process-node"><p class="eyebrow">Node ${index + 1} of ${orderedNodes.length}</p><h3 id="node-${escapeHtml(node.id)}" tabindex="-1">${escapeHtml(node.label)}</h3><p>${escapeHtml(node.description)}</p><span class="provenance">Node provenance: ${escapeHtml(STATUS_LABELS[node.status])}</span><h4>Outgoing connections</h4>${renderConnections(outgoing, lesson)}</article></li>`;
    })
    .join("");

  return `<p class="eyebrow">Standalone process lesson</p><h1>${escapeHtml(lesson.title)}</h1><p class="summary">${escapeHtml(lesson.summary)}</p>${renderMetadata([
    ["Structure", "Directed process"],
    ["Nodes", String(lesson.nodes.length)],
    ["Connections", String(lesson.edges.length)],
    ["Reading order", `${lesson.readingOrder.length} nodes`],
  ])}<section class="lesson-section" aria-labelledby="process-heading"><h2 id="process-heading">Process nodes and relationships</h2><p class="section-intro">The ordered list provides a narration path. Every outgoing relationship names its destination.</p><ol class="process-order" aria-label="Process reading order">${nodes}</ol></section>`;
}

function renderDocument(title: string, content: string, mode: ReviewMode): string {
  const escapedTitle = escapeHtml(title);
  const script =
    mode === "chart" ? `<script>${CHART_ENHANCEMENT_SCRIPT}</script>` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="Optiq ${escapeHtml(OPTIQ_EXPORT_VERSION)}">
  <title>${escapedTitle} — Optiq accessible lesson</title>
  <style>${STANDALONE_CSS}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <main id="main-content">
    ${content}
    <p class="review-note"><strong>AI-assisted and teacher-reviewed.</strong> Generated content can be incorrect. This lesson was reviewed before export; that review is not an accessibility certification.</p>
  </main>
  <footer>
    <p>Created with Optiq.</p>
    <p>Generator version ${escapeHtml(OPTIQ_EXPORT_VERSION)}.</p>
  </footer>
  ${script}
</body>
</html>`;
}

export function createStandaloneExport(
  state: TeacherReviewState<ChartLesson>,
  mode: "chart",
): StandaloneExportArtifact;
export function createStandaloneExport(
  state: TeacherReviewState<ProcessLesson>,
  mode: "process",
): StandaloneExportArtifact;
export function createStandaloneExport(
  state: TeacherReviewState<ReviewLesson>,
  mode: ReviewMode,
): StandaloneExportArtifact {
  const eligibility = exportEligibility(state, mode);
  if (!eligibility.allowed) throw new ExportBlockedError(eligibility.reasons);

  const content =
    mode === "chart"
      ? renderChartLesson(state.draft as ChartLesson)
      : renderProcessLesson(state.draft as ProcessLesson);
  return {
    filename: safeExportFilename(state.draft.title),
    html: renderDocument(state.draft.title, content, mode),
    mimeType: STANDALONE_EXPORT_MIME,
  };
}
