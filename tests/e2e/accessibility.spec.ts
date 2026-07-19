import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { createStandaloneExport } from "../../src/lib/export/standalone";
import {
  createTeacherReviewState,
  setReviewerAcknowledged,
} from "../../src/lib/review/state";
import { getChartSample } from "../../src/lib/samples/chart-samples";
import { getProcessSample } from "../../src/lib/samples/process-samples";

const WCAG_AA_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const;

function relativeLuminance(color: string): number {
  const components = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!components || components.length !== 3) {
    throw new Error(`Cannot parse computed color: ${color}`);
  }
  const [red, green, blue] = components.map((component) => {
    const channel = component! / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

async function expectAxeClean(
  page: Page,
  testInfo: TestInfo,
  state: string,
  expectedIncompleteIds: readonly string[] = [],
) {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_AA_TAGS])
    .analyze();
  const review = {
    incomplete: results.incomplete.map(({ help, id, impact, nodes, tags }) => ({
      help,
      id,
      impact,
      nodes: nodes.map(({ all, any, none, target }) => ({
        checks: [...all, ...any, ...none].map(({ message }) => message),
        target,
      })),
      tags,
    })),
    state,
    violations: results.violations.map(
      ({ help, id, impact, nodes, tags }) => ({
        help,
        id,
        impact,
        nodes: nodes.map(({ target }) => ({ target })),
        tags,
      }),
    ),
  };
  const reportName = `axe-${state.replace(/[^a-z0-9]+/gi, "-")}.json`;
  const reportPath = testInfo.outputPath(reportName);
  await writeFile(reportPath, JSON.stringify(review, null, 2), "utf8");
  await testInfo.attach(reportName, {
    contentType: "application/json",
    path: reportPath,
  });
  expect(results.violations, `${state} has axe violations`).toEqual([]);
  expect(
    review.incomplete.map(({ id }) => id).sort(),
    `${state} has unreviewed axe incomplete results`,
  ).toEqual([...expectedIncompleteIds].sort());
  return review.incomplete;
}

function installFakeAudio(page: Page) {
  return page.addInitScript(() => {
    class FakeAudioParam {
      linearRampToValueAtTime(): FakeAudioParam {
        return this;
      }
      setValueAtTime(): FakeAudioParam {
        return this;
      }
    }
    class FakeOscillator {
      readonly frequency = new FakeAudioParam();
      onended: (() => void) | null = null;
      type = "sine";
      connect(): void {}
      disconnect(): void {}
      start(): void {}
      stop(): void {}
    }
    class FakeGain {
      readonly gain = new FakeAudioParam();
      connect(): void {}
      disconnect(): void {}
    }
    class FakeAudioContext {
      readonly currentTime = 0;
      readonly destination = {};
      state = "suspended";
      close(): Promise<void> {
        this.state = "closed";
        return Promise.resolve();
      }
      createGain(): FakeGain {
        return new FakeGain();
      }
      createOscillator(): FakeOscillator {
        return new FakeOscillator();
      }
      resume(): Promise<void> {
        this.state = "running";
        return Promise.resolve();
      }
    }
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
  });
}

for (const route of [
  "/",
  "/product",
  "/how-it-works",
  "/accessibility",
  "/examples",
  "/create",
]) {
  test(`has no detectable accessibility violations on ${route}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);

    await page.goto(route);
    await expectAxeClean(page, testInfo, `route-${route === "/" ? "home" : route}`);
  });
}

test("has no detectable violations in invalid upload state", async ({
  page,
}, testInfo) => {
  await page.goto("/create");
  await page.getByLabel("Image file").setInputFiles({
    buffer: Buffer.from("not an image"),
    mimeType: "text/plain",
    name: "notes.txt",
  });
  await expect(page.locator("#upload-error")).toHaveText(
    "Choose a PNG, JPEG, or WebP image.",
  );
  await expectAxeClean(page, testInfo, "invalid-upload");
});

test("has no detectable violations in loading and provider-error states", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  let releaseRequest!: () => void;
  const requestGate = new Promise<void>((resolveRequest) => {
    releaseRequest = resolveRequest;
  });
  await page.route("**/api/analyze", async (route) => {
    await requestGate;
    await route.fulfill({
      body: JSON.stringify({
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message:
            "Live analysis is temporarily unavailable. Try again shortly or explore a built-in sample.",
          retryable: true,
        },
        ok: false,
        requestId: "a11y-provider-error",
      }),
      contentType: "application/json",
      status: 503,
    });
  });
  await page.goto("/create");
  await page
    .getByLabel("Image file")
    .setInputFiles(resolve("fixtures/images/chart-bar-01.png"));
  await page.getByRole("button", { name: "Analyze source" }).click();
  await expect(page.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "Reading visible structure",
  );
  await expectAxeClean(page, testInfo, "analysis-loading");

  releaseRequest();
  await expect(
    page.getByRole("heading", { name: "Analysis error" }),
  ).toBeFocused();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expectAxeClean(page, testInfo, "provider-error");
});

test("has no detectable accessibility violations in the chart success state", async ({
  page,
}, testInfo) => {
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });

  await installFakeAudio(page);
  await page.goto("/create");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  await expectAxeClean(page, testInfo, "chart-lesson");
  await page.getByRole("button", { name: "Play series" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
  await expectAxeClean(page, testInfo, "chart-active-playback");
  expect(consoleIssues).toEqual([]);
});

test("has no detectable accessibility violations in the process success state", async ({
  page,
}, testInfo) => {
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto("/create");
  await page
    .locator("label.source-choice")
    .filter({ hasText: "Process diagram" })
    .click();
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("list", { name: "Process reading order" })).toBeVisible();

  await expectAxeClean(page, testInfo, "process-lesson", ["color-contrast"]);
  const connectionColors = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".process-connections a")].map(
      (link) => {
        let ancestor: HTMLElement | null = link;
        let background = "rgba(0, 0, 0, 0)";
        while (ancestor) {
          const candidate = getComputedStyle(ancestor).backgroundColor;
          if (
            candidate !== "rgba(0, 0, 0, 0)" &&
            candidate !== "transparent"
          ) {
            background = candidate;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        return {
          background,
          foreground: getComputedStyle(link).color,
          text: link.textContent?.trim() ?? "",
        };
      },
    ),
  );
  expect(connectionColors.length).toBeGreaterThan(0);
  const contrastReview = connectionColors.map(
    ({ background, foreground, text }) => ({
      background,
      foreground,
      ratio: contrastRatio(foreground, background),
      text,
    }),
  );
  for (const { background, foreground, ratio, text } of contrastReview) {
    expect(
      ratio,
      `${text} computed contrast (${foreground} on ${background})`,
    ).toBeGreaterThanOrEqual(4.5);
  }
  const contrastReportPath = testInfo.outputPath(
    "process-relationship-contrast.json",
  );
  await writeFile(
    contrastReportPath,
    JSON.stringify(contrastReview, null, 2),
    "utf8",
  );
  await testInfo.attach("process-relationship-contrast.json", {
    contentType: "application/json",
    path: contrastReportPath,
  });
  expect(consoleIssues).toEqual([]);
});

test("has no detectable accessibility violations in the teacher review state", async ({
  page,
}, testInfo) => {
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto("/create");
  await page
    .getByRole("combobox", { name: "Built-in chart" })
    .selectOption("chart-review-01");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(
    page.getByRole("heading", { name: "Review the extracted lesson" }),
  ).toBeVisible();

  await expectAxeClean(page, testInfo, "review-unresolved");

  const value = page.getByRole("textbox", {
    name: "Visits — Mar — numeric value",
  });
  await value.fill("");
  await expect(value).toHaveAccessibleDescription("Enter a finite number.");
  await expect(value).toHaveAttribute("aria-invalid", "true");
  await expectAxeClean(page, testInfo, "review-invalid-value");

  await value.fill("145");
  const valueItem = page
    .getByRole("heading", {
      level: 4,
      name: "Visits — Mar — numeric value",
    })
    .locator("xpath=ancestor::article");
  await valueItem.getByRole("button", { name: "Mark resolved" }).click();
  const trendItem = page
    .getByRole("heading", { level: 4, name: "Trend 1" })
    .locator("xpath=ancestor::article");
  await trendItem.getByRole("button", { name: "Mark resolved" }).click();
  await page
    .getByRole("checkbox", {
      name: /I reviewed the extracted values, labels, order, and relationships/,
    })
    .check();
  await expect(page.getByRole("button", { name: "Export lesson" })).toBeEnabled();
  await expectAxeClean(page, testInfo, "review-export-ready");
  expect(consoleIssues).toEqual([]);
});

test("has no detectable violations in generated chart and process exports", async ({
  context,
  page,
}, testInfo) => {
  let chartState = createTeacherReviewState(
    structuredClone(getChartSample("chart-bar-02").lesson),
  );
  chartState = setReviewerAcknowledged(chartState, true);
  const chart = createStandaloneExport(chartState, "chart");

  let processState = createTeacherReviewState(
    structuredClone(getProcessSample("process-01").lesson),
  );
  processState = setReviewerAcknowledged(processState, true);
  const process = createStandaloneExport(processState, "process");
  const chartPath = testInfo.outputPath(chart.filename);
  const processPath = testInfo.outputPath(process.filename);
  await writeFile(chartPath, chart.html, "utf8");
  await writeFile(processPath, process.html, "utf8");
  await context.setOffline(true);

  await page.goto(pathToFileURL(chartPath).href);
  await expect(page.getByRole("table")).toBeVisible();
  await expectAxeClean(page, testInfo, "standalone-chart");

  await page.goto(pathToFileURL(processPath).href);
  await expect(page.locator(".process-order > li")).toHaveCount(5);
  await expectAxeClean(page, testInfo, "standalone-process");
});

test("preserves reflow and visible focus with forced colors and reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.setViewportSize({ height: 900, width: 320 });
  await page.goto("/create");
  await expect(page.getByRole("button", { name: "Open" })).toBeVisible();
  await page.getByRole("button", { name: "Open" }).click();

  const mediaAndReflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    forcedColors: matchMedia("(forced-colors: active)").matches,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(mediaAndReflow).toMatchObject({
    forcedColors: true,
    reducedMotion: true,
  });
  expect(mediaAndReflow.scrollWidth).toBeLessThanOrEqual(
    mediaAndReflow.clientWidth,
  );

  const play = page.getByRole("button", { name: "Play series" });
  await page.getByRole("button", { name: "Next point" }).focus();
  await page.keyboard.press("Tab");
  await expect(play).toBeFocused();
  const focusReview = await play.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      bottom: rectangle.bottom,
      left: rectangle.left,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      right: rectangle.right,
      top: rectangle.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  expect(focusReview.outlineStyle).not.toBe("none");
  expect(focusReview.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(focusReview.left).toBeGreaterThanOrEqual(0);
  expect(focusReview.right).toBeLessThanOrEqual(focusReview.viewportWidth);
  expect(focusReview.top).toBeGreaterThanOrEqual(0);
  expect(focusReview.bottom).toBeLessThanOrEqual(focusReview.viewportHeight);
  const reportPath = testInfo.outputPath("forced-colors-review.json");
  await writeFile(
    reportPath,
    JSON.stringify({ focusReview, mediaAndReflow }, null, 2),
    "utf8",
  );
  await testInfo.attach("forced-colors-review.json", {
    contentType: "application/json",
    path: reportPath,
  });
});

test("returns from browser navigation and refresh without stale lesson state", async ({
  page,
}) => {
  await installFakeAudio(page);
  await page.goto("/create");
  await page.getByRole("button", { name: "Open" }).click();
  await page.getByRole("button", { name: "Play series" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();

  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Examples" })
    .click();
  await expect(page).toHaveURL(/\/examples$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole("button", { name: "Choose a file" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Choose a file" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Analysis result" })).toHaveCount(
    0,
  );
});
