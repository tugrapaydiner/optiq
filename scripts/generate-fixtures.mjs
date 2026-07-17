import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE_DIR = join(ROOT, "fixtures", "images");
const GOLD_DIR = join(ROOT, "fixtures", "gold");
const WIDTH = 1600;
const HEIGHT = 1000;
const COLORS = {
  accent: "#315961",
  accentLight: "#dbe6e4",
  background: "#f3efe6",
  brown: "#8a634a",
  grid: "#c9c4ba",
  ink: "#11120f",
  muted: "#65645f",
  surface: "#faf8f3",
};
const VERIFIED = "verified_visible_text";
const INFERRED = "inferred_from_layout";

const chartFixtures = [
  {
    id: "chart-bar-01",
    chartType: "bar",
    title: "Monthly library visits",
    summary: "Library visits increase overall from January to May.",
    xAxis: { label: "Month", unit: null },
    yAxis: { label: "Visits", unit: "visits", visibleMin: 0, visibleMax: 250 },
    ticks: [0, 50, 100, 150, 200, 250],
    categories: ["Jan", "Feb", "Mar", "Apr", "May"],
    series: [{ id: "visits", label: "Visits", values: [120, 165, 142, 190, 210] }],
    trends: [
      {
        id: "visits-overall-rise",
        text: "Visits rise overall from 120 in January to 210 in May.",
      },
    ],
    challenge: "Clean single-series bars with five directly labelled values.",
  },
  {
    id: "chart-bar-02",
    chartType: "bar",
    title: "Plant height by light condition",
    summary: "Both plant groups are taller under stronger light conditions.",
    xAxis: { label: "Light condition", unit: null },
    yAxis: { label: "Mean plant height", unit: "cm", visibleMin: 0, visibleMax: 30 },
    ticks: [0, 6, 12, 18, 24, 30],
    categories: ["Low", "Medium", "High", "Full"],
    series: [
      { id: "bean", label: "Bean", values: [8, 14, 22, 27] },
      { id: "pea", label: "Pea", values: [6, 12, 18, 24] },
    ],
    trends: [
      {
        id: "bean-rises",
        text: "Bean height rises from 8 cm in low light to 27 cm in full light.",
      },
      {
        id: "pea-rises",
        text: "Pea height rises from 6 cm in low light to 24 cm in full light.",
      },
    ],
    challenge: "Two grouped series with a clear legend and eight exact values.",
  },
  {
    id: "chart-line-01",
    chartType: "line",
    title: "Morning temperature",
    summary: "Temperature rises from below zero, peaks at noon, then falls slightly.",
    xAxis: { label: "Time", unit: null },
    yAxis: { label: "Temperature", unit: "°C", visibleMin: -5, visibleMax: 6 },
    ticks: [-5, 0, 5],
    categories: ["06:00", "08:00", "10:00", "12:00", "14:00"],
    series: [{ id: "temperature", label: "Temperature", values: [-4, -1, 2, 5, 3] }],
    trends: [
      {
        id: "temperature-crosses-zero",
        text: "Temperature crosses zero between 08:00 and 10:00.",
      },
      {
        id: "temperature-noon-peak",
        text: "Temperature reaches 5 °C at 12:00 before falling to 3 °C.",
      },
    ],
    challenge: "Single line with a negative value and visible zero crossing.",
  },
  {
    id: "chart-line-02",
    chartType: "line",
    title: "Quiz score by study method",
    summary: "Both methods improve, with retrieval practice increasing more quickly.",
    xAxis: { label: "Week", unit: null },
    yAxis: { label: "Average quiz score", unit: "%", visibleMin: 55, visibleMax: 90 },
    ticks: [55, 60, 70, 80, 90],
    categories: ["Week 1", "Week 2", "Week 3", "Week 4"],
    series: [
      { id: "retrieval", label: "Retrieval practice", values: [62, 70, 78, 85] },
      { id: "rereading", label: "Rereading", values: [61, 64, 66, 68] },
    ],
    trends: [
      {
        id: "retrieval-faster-rise",
        text: "Retrieval practice rises by 23 points from Week 1 to Week 4.",
      },
      {
        id: "rereading-slower-rise",
        text: "Rereading rises by 7 points from Week 1 to Week 4.",
      },
    ],
    challenge: "Two nearby lines, a legend, and eight exact percentage values.",
  },
];

const processFixtures = [
  {
    id: "process-01",
    title: "Seed germination: parallel growth",
    summary:
      "After a seed absorbs water, root and shoot growth form two connected branches before the first leaves open.",
    nodes: [
      {
        id: "seed",
        order: "1",
        label: "Seed",
        description: "A dry seed begins the process.",
        x: 90,
        y: 395,
      },
      {
        id: "water",
        order: "2",
        label: "Absorbs water",
        description: "The seed coat takes in water.",
        x: 435,
        y: 395,
      },
      {
        id: "root",
        order: "3a",
        label: "Root emerges",
        description: "The first root grows downward.",
        x: 805,
        y: 250,
      },
      {
        id: "shoot",
        order: "3b",
        label: "Shoot emerges",
        description: "The shoot grows upward.",
        x: 805,
        y: 540,
      },
      {
        id: "leaves",
        order: "4",
        label: "First leaves open",
        description: "The young plant opens its first leaves.",
        x: 1175,
        y: 395,
      },
    ],
    edges: [
      { id: "seed-to-water", from: "seed", to: "water" },
      { id: "water-to-root", from: "water", to: "root" },
      { id: "water-to-shoot", from: "water", to: "shoot" },
      { id: "root-to-leaves", from: "root", to: "leaves" },
      { id: "shoot-to-leaves", from: "shoot", to: "leaves" },
    ],
    readingOrder: ["seed", "water", "root", "shoot", "leaves"],
    challenge: "A readable five-node process with one split and one merge.",
  },
  {
    id: "process-02",
    title: "Water cycle",
    summary:
      "A repeating cycle moves water through evaporation, condensation, precipitation, and collection before returning to evaporation.",
    nodes: [
      {
        id: "evaporation",
        order: "1",
        label: "Evaporation",
        description: "Liquid water becomes water vapour.",
        x: 170,
        y: 255,
      },
      {
        id: "condensation",
        order: "2",
        label: "Condensation",
        description: "Water vapour cools into droplets.",
        x: 1070,
        y: 255,
      },
      {
        id: "precipitation",
        order: "3",
        label: "Precipitation",
        description: "Water falls from clouds.",
        x: 1070,
        y: 625,
      },
      {
        id: "collection",
        order: "4",
        label: "Collection",
        description: "Water gathers in lakes and oceans.",
        x: 170,
        y: 625,
      },
    ],
    edges: [
      { id: "evaporation-to-condensation", from: "evaporation", to: "condensation" },
      { id: "condensation-to-precipitation", from: "condensation", to: "precipitation" },
      { id: "precipitation-to-collection", from: "precipitation", to: "collection" },
      { id: "collection-to-evaporation", from: "collection", to: "evaporation" },
    ],
    readingOrder: ["evaporation", "condensation", "precipitation", "collection"],
    challenge: "A four-node directed cycle with a numbered reading start.",
  },
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function svgShell(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.background}"/>
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill: ${COLORS.ink}; }
    .title { font-size: 54px; font-weight: 700; }
    .axis { font-size: 25px; font-weight: 600; }
    .tick { font-size: 22px; fill: ${COLORS.muted}; }
    .value { font-size: 22px; font-weight: 700; }
    .legend { font-size: 24px; font-weight: 600; }
    .node-title { font-size: 29px; font-weight: 700; }
    .node-copy { font-size: 21px; fill: ${COLORS.muted}; }
    .order { font-size: 23px; font-weight: 700; fill: white; }
  </style>
  ${content}
</svg>`;
}

function numberTicks(min, max, count = 5) {
  return Array.from({ length: count + 1 }, (_, index) =>
    min + ((max - min) * index) / count,
  );
}

function formatTick(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function renderLegend(series, x, y) {
  const swatches = [COLORS.accent, COLORS.brown];
  return series
    .map(
      ({ label }, index) => `<g transform="translate(${x + index * 360} ${y})">
        <rect x="0" y="-20" width="38" height="22" rx="5" fill="${swatches[index]}"/>
        <text class="legend" x="54" y="0">${escapeXml(label)}</text>
      </g>`,
    )
    .join("\n");
}

function renderChartSvg(fixture) {
  const plot = { x: 185, y: 205, width: 1260, height: 590 };
  const min = fixture.yAxis.visibleMin;
  const max = fixture.yAxis.visibleMax;
  const range = max - min;
  const yFor = (value) => plot.y + plot.height - ((value - min) / range) * plot.height;
  const ticks = fixture.ticks ?? numberTicks(min, max);
  const grid = ticks
    .map((tick) => {
      const y = yFor(tick);
      return `<line x1="${plot.x}" y1="${y}" x2="${plot.x + plot.width}" y2="${y}" stroke="${COLORS.grid}" stroke-width="2"/>
        <text class="tick" x="${plot.x - 24}" y="${y + 8}" text-anchor="end">${escapeXml(formatTick(tick))}</text>`;
    })
    .join("\n");
  const xStep = plot.width / fixture.categories.length;
  const xLabels = fixture.categories
    .map(
      (label, index) => `<text class="tick" x="${plot.x + xStep * (index + 0.5)}" y="${plot.y + plot.height + 50}" text-anchor="middle">${escapeXml(label)}</text>`,
    )
    .join("\n");
  const legend = fixture.series.length > 1 ? renderLegend(fixture.series, 820, 165) : "";

  let marks;
  if (fixture.chartType === "bar") {
    const groupWidth = xStep * 0.68;
    const gap = fixture.series.length === 1 ? 0 : 14;
    const barWidth = (groupWidth - gap * (fixture.series.length - 1)) / fixture.series.length;
    const fills = [COLORS.accent, COLORS.brown];
    marks = fixture.series
      .flatMap((series, seriesIndex) =>
        series.values.map((value, categoryIndex) => {
          const x =
            plot.x +
            categoryIndex * xStep +
            (xStep - groupWidth) / 2 +
            seriesIndex * (barWidth + gap);
          const y = yFor(value);
          const zeroY = yFor(Math.max(min, 0));
          return `<rect x="${x}" y="${Math.min(y, zeroY)}" width="${barWidth}" height="${Math.abs(zeroY - y)}" rx="7" fill="${fills[seriesIndex]}"/>
            <text class="value" x="${x + barWidth / 2}" y="${y - 14}" text-anchor="middle">${escapeXml(value)}</text>`;
        }),
      )
      .join("\n");
  } else {
    const strokes = [COLORS.accent, COLORS.brown];
    marks = fixture.series
      .map((series, seriesIndex) => {
        const points = series.values.map((value, index) => ({
          x: plot.x + xStep * (index + 0.5),
          y: yFor(value),
          value,
        }));
        const labelOffset = fixture.series.length > 1 && seriesIndex === 1 ? 44 : -22;
        return `<polyline points="${points.map(({ x, y }) => `${x},${y}`).join(" ")}" fill="none" stroke="${strokes[seriesIndex]}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
          ${points
            .map(
              ({ x, y, value }) => `<circle cx="${x}" cy="${y}" r="11" fill="${COLORS.surface}" stroke="${strokes[seriesIndex]}" stroke-width="7"/>
                <text class="value" x="${x}" y="${y + labelOffset}" text-anchor="middle">${escapeXml(value)}</text>`,
            )
            .join("\n")}`;
      })
      .join("\n");
  }

  return svgShell(`
    <text class="title" x="80" y="105">${escapeXml(fixture.title)}</text>
    ${legend}
    ${grid}
    <line x1="${plot.x}" y1="${plot.y}" x2="${plot.x}" y2="${plot.y + plot.height}" stroke="${COLORS.ink}" stroke-width="4"/>
    <line x1="${plot.x}" y1="${plot.y + plot.height}" x2="${plot.x + plot.width}" y2="${plot.y + plot.height}" stroke="${COLORS.ink}" stroke-width="4"/>
    ${marks}
    ${xLabels}
    <text class="axis" x="${plot.x + plot.width / 2}" y="930" text-anchor="middle">${escapeXml(fixture.xAxis.label)}</text>
    <text class="axis" transform="translate(55 ${plot.y + plot.height / 2}) rotate(-90)" text-anchor="middle">${escapeXml(`${fixture.yAxis.label} (${fixture.yAxis.unit})`)}</text>
  `);
}

function chartGold(fixture) {
  return {
    schemaVersion: "1.0",
    supported: true,
    unsupportedReason: null,
    title: fixture.title,
    summary: fixture.summary,
    chartType: fixture.chartType,
    xAxis: fixture.xAxis,
    yAxis: fixture.yAxis,
    series: fixture.series.map((series) => ({
      id: `${fixture.id}-${series.id}`,
      label: series.label,
      points: fixture.categories.map((xLabel, index) => ({
        id: `${fixture.id}-${series.id}-${index + 1}`,
        xLabel,
        value: series.values[index],
        displayValue: `${series.values[index]}${fixture.yAxis.unit === "%" ? "%" : fixture.yAxis.unit === "°C" ? " °C" : fixture.yAxis.unit === "cm" ? " cm" : ""}`,
        status: VERIFIED,
      })),
    })),
    trends: fixture.trends.map((trend) => ({ ...trend, status: VERIFIED })),
    reviewItems: [],
  };
}

function renderProcessEdge(from, to) {
  const fromCenter = { x: from.x + 165, y: from.y + 75 };
  const toCenter = { x: to.x + 165, y: to.y + 75 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const start = horizontal
    ? { x: fromCenter.x + Math.sign(dx) * 165, y: fromCenter.y }
    : { x: fromCenter.x, y: fromCenter.y + Math.sign(dy) * 75 };
  const end = horizontal
    ? { x: toCenter.x - Math.sign(dx) * 178, y: toCenter.y }
    : { x: toCenter.x, y: toCenter.y - Math.sign(dy) * 88 };

  if (horizontal && Math.abs(dy) > 40) {
    const middleX = (start.x + end.x) / 2;
    return `<polyline points="${start.x},${start.y} ${middleX},${start.y} ${middleX},${end.y} ${end.x},${end.y}" fill="none" stroke="${COLORS.accent}" stroke-width="7" stroke-linejoin="round" marker-end="url(#arrow)"/>`;
  }
  return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${COLORS.accent}" stroke-width="7" marker-end="url(#arrow)"/>`;
}

function renderProcessSvg(fixture) {
  const nodeById = new Map(fixture.nodes.map((node) => [node.id, node]));
  const edges = fixture.edges
    .map((edge) => renderProcessEdge(nodeById.get(edge.from), nodeById.get(edge.to)))
    .join("\n");
  const nodes = fixture.nodes
    .map((node) => {
      const words = node.description.split(" ");
      const lines = [""];
      for (const word of words) {
        const lineIndex = lines.length - 1;
        const candidate = `${lines[lineIndex]} ${word}`.trim();
        if (candidate.length > 29 && lines[lineIndex]) {
          lines.push(word);
        } else {
          lines[lineIndex] = candidate;
        }
      }
      const description = lines
        .slice(0, 2)
        .map(
          (line, index) => `<text class="node-copy" x="28" y="${96 + index * 27}">${escapeXml(line)}</text>`,
        )
        .join("\n");
      return `<g transform="translate(${node.x} ${node.y})">
        <rect width="330" height="150" rx="24" fill="${COLORS.surface}" stroke="${COLORS.grid}" stroke-width="3"/>
        <circle cx="42" cy="42" r="25" fill="${COLORS.accent}"/>
        <text class="order" x="42" y="50" text-anchor="middle">${escapeXml(node.order)}</text>
        <text class="node-title" x="82" y="50">${escapeXml(node.label)}</text>
        ${description}
      </g>`;
    })
    .join("\n");

  return svgShell(`
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${COLORS.accent}"/>
      </marker>
    </defs>
    <text class="title" x="80" y="105">${escapeXml(fixture.title)}</text>
    <text class="tick" x="82" y="150">Follow the numbered reading order and the arrow direction.</text>
    ${edges}
    ${nodes}
  `);
}

function processGold(fixture) {
  return {
    schemaVersion: "1.0",
    supported: true,
    unsupportedReason: null,
    title: fixture.title,
    summary: fixture.summary,
    nodes: fixture.nodes.map(({ id, label, description }) => ({
      id,
      label,
      description,
      status: VERIFIED,
    })),
    edges: fixture.edges.map(({ id, from, to }) => ({
      id,
      from,
      to,
      label: null,
      status: INFERRED,
    })),
    readingOrder: fixture.readingOrder,
    reviewItems: [],
  };
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function renderPng(id, svg) {
  await sharp(Buffer.from(svg))
    .png({ adaptiveFiltering: false, compressionLevel: 9, palette: false })
    .toFile(join(IMAGE_DIR, `${id}.png`));
}

await mkdir(IMAGE_DIR, { recursive: true });
await mkdir(GOLD_DIR, { recursive: true });

for (const fixture of chartFixtures) {
  await renderPng(fixture.id, renderChartSvg(fixture));
  await writeJson(join(GOLD_DIR, `${fixture.id}.json`), chartGold(fixture));
}

for (const fixture of processFixtures) {
  await renderPng(fixture.id, renderProcessSvg(fixture));
  await writeJson(join(GOLD_DIR, `${fixture.id}.json`), processGold(fixture));
}

const inventory = [...chartFixtures, ...processFixtures].map((fixture) => ({
  challenge: fixture.challenge,
  gold: `fixtures/gold/${fixture.id}.json`,
  id: fixture.id,
  image: `fixtures/images/${fixture.id}.png`,
  kind:
    "chartType" in fixture
      ? fixture.chartType
      : fixture.id === "process-01"
        ? "branching_process"
        : "cyclic_process",
  mode: "chartType" in fixture ? "chart" : "process",
}));

await writeJson(join(ROOT, "fixtures", "provenance.json"), {
  schemaVersion: "1.0",
  generator: {
    path: "scripts/generate-fixtures.mjs",
    seed: "optiq-owned-fixtures-v1",
    version: "1.0.0",
  },
  license: {
    holder: "Optiq project",
    spdx: "CC0-1.0",
    statement: "Original synthetic data and graphics created specifically for Optiq.",
  },
  fixtures: inventory,
});

console.log(`Generated ${inventory.length} deterministic Optiq fixtures.`);
