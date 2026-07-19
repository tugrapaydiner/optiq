import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { createStandaloneExport } from "../../src/lib/export/standalone";
import {
  createTeacherReviewState,
  resolveReviewItem,
  setReviewerAcknowledged,
  updateNumberField,
  updateTextField,
} from "../../src/lib/review/state";
import { getChartSample } from "../../src/lib/samples/chart-samples";
import { getProcessSample } from "../../src/lib/samples/process-samples";

function reviewedChartArtifact() {
  let state = createTeacherReviewState(
    structuredClone(getChartSample("chart-review-01").lesson),
  );
  state = updateNumberField(
    state,
    "/series/chart-bar-01-visits/points/chart-bar-01-visits-3/value",
    "145",
  );
  state = updateTextField(
    state,
    "/trends/visits-overall-rise/text",
    "Visits rise overall from 120 in January to 210 in May, with March reviewed as 145.",
  );
  state = resolveReviewItem(state, "review-march-value", "chart").state;
  const trendItem = state.draft.reviewItems.find(({ id }) =>
    id.startsWith("stale-"),
  )!;
  state = resolveReviewItem(state, trendItem.id, "chart").state;
  state = setReviewerAcknowledged(state, true);
  return createStandaloneExport(state, "chart");
}

function reviewedProcessArtifact() {
  let state = createTeacherReviewState(
    structuredClone(getProcessSample("process-01").lesson),
  );
  state = setReviewerAcknowledged(state, true);
  return createStandaloneExport(state, "process");
}

test("downloads an eligible reviewed chart as standalone HTML", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/create");
  await page
    .getByRole("combobox", { name: "Built-in chart" })
    .selectOption("chart-review-01");
  await page.getByRole("button", { name: "Open", exact: true }).click();

  const value = page.getByRole("textbox", {
    name: "Visits — Mar — numeric value",
  });
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

  const exportButton = page.getByRole("button", { name: "Export lesson" });
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  const outputPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(outputPath);
  const html = await readFile(outputPath, "utf8");

  expect(download.suggestedFilename()).toBe(
    "optiq-monthly-library-visits.html",
  );
  expect(Buffer.byteLength(html)).toBeGreaterThan(5_000);
  expect(html).toContain('data-value="145"');
  expect(html).not.toMatch(/data:image|OPENAI_API_KEY/i);
  await expect(page.getByTestId("review-announcement")).toHaveText(
    "Downloaded optiq-monthly-library-visits.html.",
  );
});

test("loads the chart export offline with keyboard, sound, print, and axe", async ({
  context,
  page,
}, testInfo) => {
  const artifact = reviewedChartArtifact();
  const outputPath = testInfo.outputPath(artifact.filename);
  await writeFile(outputPath, artifact.html, "utf8");
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!/^(?:file|data|blob|about):/i.test(url)) externalRequests.push(url);
  });
  await page.addInitScript(() => {
    const audit = { closes: 0, starts: 0, stops: 0 };
    Object.assign(window, { __optiqExportAudioAudit: audit });

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
      start(): void {
        audit.starts += 1;
      }
      stop(): void {
        audit.stops += 1;
      }
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
        audit.closes += 1;
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
  await context.setOffline(true);
  await page.goto(pathToFileURL(outputPath).href);

  await expect(
    page.getByRole("heading", { name: "Monthly library visits" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", {
      name: "Monthly library visits — exact reviewed values",
    }),
  ).toBeVisible();
  await expect(page.locator('td[data-value="145"]')).toContainText("145 visits");
  expect(externalRequests).toEqual([]);

  const readout = page.locator("[data-point-readout]");
  await readout.focus();
  await page.keyboard.press("ArrowRight");
  await expect(readout).toContainText("Feb — 165 visits — point 2 of 5");

  await page.clock.install();
  const play = page.getByRole("button", { name: "Play series" });
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as Window & {
          __optiqExportAudioAudit: { starts: number };
        }).__optiqExportAudioAudit.starts,
    ),
  ).toBe(5);
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.locator("[data-audio-status]")).toHaveText(
    "Playback stopped.",
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("table")).toBeVisible();
  await expect(page.locator("[data-chart-enhancement]")).toBeHidden();

  await page.emulateMedia({ media: "screen" });
  for (const width of [640, 390]) {
    await page.setViewportSize({ height: 800, width });
    await expect(page.locator('td[data-value="145"]')).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});

test("keeps chart and process core content complete without JavaScript", async ({
  browser,
}, testInfo) => {
  const chart = reviewedChartArtifact();
  const process = reviewedProcessArtifact();
  const chartPath = testInfo.outputPath(chart.filename);
  const processPath = testInfo.outputPath(process.filename);
  await writeFile(chartPath, chart.html, "utf8");
  await writeFile(processPath, process.html, "utf8");

  const noScriptContext = await browser.newContext({
    javaScriptEnabled: false,
    offline: true,
  });
  const page = await noScriptContext.newPage();
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!/^(?:file|data|blob|about):/i.test(url)) externalRequests.push(url);
  });

  await page.goto(pathToFileURL(chartPath).href);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator('td[data-value="145"]')).toContainText("145 visits");
  await expect(page.locator("[data-chart-enhancement]")).toBeHidden();

  await page.goto(pathToFileURL(processPath).href);
  await expect(
    page.getByRole("heading", { name: "Seed germination: parallel growth" }),
  ).toBeVisible();
  await expect(page.locator(".process-order > li")).toHaveCount(5);
  await expect(page.locator(".connections li")).toHaveCount(5);
  await expect(
    page.getByRole("link", { name: "Connects to: Root emerges" }),
  ).toBeVisible();
  expect(externalRequests).toEqual([]);
  await noScriptContext.close();
});

test("loads the process export from file with zero network and no axe violations", async ({
  context,
  page,
}, testInfo) => {
  const artifact = reviewedProcessArtifact();
  const outputPath = testInfo.outputPath(artifact.filename);
  await writeFile(outputPath, artifact.html, "utf8");
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!/^(?:file|data|blob|about):/i.test(url)) externalRequests.push(url);
  });
  await context.setOffline(true);
  await page.goto(pathToFileURL(outputPath).href);

  await expect(page.locator(".process-order > li")).toHaveCount(5);
  expect(externalRequests).toEqual([]);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
