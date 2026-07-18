import { describe, expect, it } from "vitest";

import type { ChartLesson } from "@/lib/contracts/chart";
import {
  ExportBlockedError,
  createStandaloneExport,
} from "@/lib/export/standalone";
import {
  MAX_EXPORT_FILENAME_LENGTH,
  escapeHtml,
  safeExportFilename,
} from "@/lib/export/sanitize";
import {
  createTeacherReviewState,
  resolveReviewItem,
  setReviewerAcknowledged,
  updateNumberField,
  updateTextField,
  type TeacherReviewState,
} from "@/lib/review/state";
import {
  makeChartLesson,
  makeProcessLesson,
} from "../contracts/test-lessons";

function chartWithCriticalValue(): ChartLesson {
  const lesson = makeChartLesson();
  lesson.series[0]!.points[0]!.status = "unclear";
  lesson.reviewItems.push({
    id: "review-jan-value",
    message: "Confirm the January value.",
    severity: "critical",
    status: "unclear",
    targetPath: "/series/visits/points/jan/value",
  });
  return lesson;
}

function reviewedCorrectedChart(): TeacherReviewState<ChartLesson> {
  const valuePath = "/series/visits/points/jan/value";
  let state = createTeacherReviewState(chartWithCriticalValue());
  state = updateNumberField(state, valuePath, "125");
  state = updateTextField(
    state,
    "/trends/overall-rise/text",
    "Visits rise from 125 in January to 165 in February.",
  );
  state = resolveReviewItem(state, "review-jan-value", "chart").state;
  const trendItem = state.draft.reviewItems.find(({ id }) =>
    id.startsWith("stale-"),
  )!;
  state = resolveReviewItem(state, trendItem.id, "chart").state;
  return setReviewerAcknowledged(state, true);
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("standalone export sanitization", () => {
  it("escapes HTML characters and creates bounded conservative filenames", () => {
    expect(escapeHtml(`" & < > '`)).toBe(
      "&quot; &amp; &lt; &gt; &#39;",
    );
    const filename = safeExportFilename(
      `  Çhärt </script> ${"very long title ".repeat(20)}  `,
    );

    expect(filename).toMatch(/^optiq-[a-z0-9]+(?:-[a-z0-9]+)*\.html$/);
    expect(filename.length).toBeLessThanOrEqual(MAX_EXPORT_FILENAME_LENGTH);
    expect(safeExportFilename("***")).toBe("optiq-lesson.html");
  });
});

describe("createStandaloneExport", () => {
  it("rejects unresolved, invalid, and unacknowledged review states", () => {
    const unresolved = createTeacherReviewState(chartWithCriticalValue());
    expect(() => createStandaloneExport(unresolved, "chart")).toThrow(
      ExportBlockedError,
    );

    const invalid = updateNumberField(
      unresolved,
      "/series/visits/points/jan/value",
      "",
    );
    expect(() => createStandaloneExport(invalid, "chart")).toThrow(
      /finite number/i,
    );

    const validLesson = createTeacherReviewState(makeChartLesson());
    expect(() => createStandaloneExport(validLesson, "chart")).toThrow(
      /acknowledgement/i,
    );
  });

  it("exports the corrected chart draft with complete native semantics", () => {
    const state = reviewedCorrectedChart();
    const artifact = createStandaloneExport(state, "chart");
    const document = parse(artifact.html);
    const firstValue = document.querySelector<HTMLTableCellElement>(
      'td[data-series-index="0"]',
    );

    expect(artifact.filename).toBe("optiq-monthly-library-visits.html");
    expect(artifact.mimeType).toBe("text/html;charset=utf-8");
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector('meta[charset="utf-8"]')).not.toBeNull();
    expect(document.querySelector('meta[name="viewport"]')).not.toBeNull();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.querySelector("main#main-content")).not.toBeNull();
    expect(document.querySelector('a[href="#main-content"]')?.textContent).toBe(
      "Skip to main content",
    );
    expect(document.querySelector("table caption")?.textContent).toContain(
      "exact reviewed values",
    );
    expect(firstValue?.getAttribute("data-value")).toBe("125");
    expect(firstValue?.textContent).toContain("125 visits");
    expect(firstValue?.textContent).not.toContain("120 visits");
    expect(document.body.textContent).toContain(
      "Visits rise from 125 in January to 165 in February.",
    );
    expect(document.body.textContent).toContain(
      "AI-assisted and teacher-reviewed.",
    );
    expect(document.body.textContent).toContain("Created with Optiq.");
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelectorAll("script")).toHaveLength(1);
    expect(document.querySelector("script")?.textContent).not.toContain(
      "Monthly library visits",
    );
    expect(artifact.html).not.toMatch(/data:image|OPENAI_API_KEY/i);
  });

  it("exports process nodes in reviewed order with each edge represented once", () => {
    let state = createTeacherReviewState(makeProcessLesson());
    state = setReviewerAcknowledged(state, true);
    const artifact = createStandaloneExport(state, "process");
    const document = parse(artifact.html);
    const nodes = [...document.querySelectorAll(".process-order > li h3")].map(
      ({ textContent }) => textContent,
    );

    expect(nodes).toEqual(["Start", "Finish"]);
    expect(document.querySelectorAll(".connections li")).toHaveLength(1);
    expect(
      document.querySelector('a[href="#node-finish"]')?.textContent,
    ).toBe("Connects to: Finish");
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("table")).toBeNull();
    expect(document.querySelector("ol[aria-label='Process reading order']")).not.toBeNull();
  });

  it("keeps script-like teacher text inert and out of authored script source", () => {
    const hostile =
      `</script><script>window.__pwned=true</script>` +
      `<img src=x onerror=alert(1)> " & < > ' \u2028 \u2029 end`;
    const lesson = makeChartLesson();
    lesson.title = hostile;
    lesson.summary = hostile;
    lesson.series[0]!.label = hostile;
    let state = createTeacherReviewState(lesson);
    state = setReviewerAcknowledged(state, true);

    const artifact = createStandaloneExport(state, "chart");
    const document = parse(artifact.html);
    const scripts = document.querySelectorAll("script");

    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.textContent).not.toContain("__pwned");
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(document.body.textContent).toContain("window.__pwned=true");
    expect(artifact.html).not.toContain(
      "</script><script>window.__pwned=true</script>",
    );
    expect(artifact.html).toContain("&lt;/script&gt;");
  });

  it("contains no remote dependency-bearing attributes", () => {
    const artifact = createStandaloneExport(reviewedCorrectedChart(), "chart");
    const document = parse(artifact.html);
    const dependencyAttributes = [
      ...document.querySelectorAll<HTMLElement>("[src], [href]"),
    ].map((element) => element.getAttribute("src") ?? element.getAttribute("href"));

    expect(
      dependencyAttributes.every(
        (value) => value !== null && value.startsWith("#"),
      ),
    ).toBe(true);
    expect(artifact.html).not.toMatch(/https?:\/\//i);
  });
});
