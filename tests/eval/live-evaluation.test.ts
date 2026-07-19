// @vitest-environment node

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import OpenAI from "openai";
import { describe, expect, it } from "vitest";

import { AnalysisFailure } from "../../src/lib/analyze/errors";
import type { AnalyzeMode, AnalyzedLesson } from "../../src/lib/analyze/types";
import type { ChartLesson } from "../../src/lib/contracts/chart";
import type { ProcessLesson } from "../../src/lib/contracts/process";
import {
  parseChartLessonJson,
  parseProcessLessonJson,
} from "../../src/lib/contracts/runtime-validation";
import {
  EVALUATION_CLASSES,
  evaluateProviderOutput,
  type EvaluationClass,
  type ExtractionEvaluation,
} from "../../src/lib/evaluation/compare";
import { createOpenAIProvider } from "../../src/lib/openai/provider";
import { EXTRACTION_PROMPT_VERSION } from "../../src/lib/openai/prompts";
import {
  chartResponseFormat,
  processResponseFormat,
} from "../../src/lib/openai/schemas";
import {
  getUploadConfig,
  PROVIDER_TIMEOUT_MS,
} from "../../src/lib/upload/config";
import {
  validateImageUpload,
  type ValidatedImage,
} from "../../src/lib/upload/validate-image";

const FIXTURES = [
  { id: "chart-bar-01", mode: "chart" },
  { id: "chart-bar-02", mode: "chart" },
  { id: "chart-line-01", mode: "chart" },
  { id: "chart-line-02", mode: "chart" },
  { id: "process-01", mode: "process" },
  { id: "process-02", mode: "process" },
] as const satisfies ReadonlyArray<{ id: string; mode: AnalyzeMode }>;

const DEMO_FIXTURE_IDS = ["chart-bar-02", "process-01"] as const;
const MAX_LIVE_CALLS = 8;
const invokedLiveEntrypoint =
  process.env.npm_lifecycle_event === "test:eval:live";
const explicitLiveFlag = process.env.OPTIQ_RUN_LIVE_EVALS === "1";
const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

type QualitativeReview =
  | {
      mode: "chart";
      reviewItems: ChartLesson["reviewItems"];
      summary: string;
      title: string;
      trends: ChartLesson["trends"];
    }
  | {
      descriptions: Array<Pick<ProcessLesson["nodes"][number], "description" | "label" | "status">>;
      mode: "process";
      reviewItems: ProcessLesson["reviewItems"];
      summary: string;
      title: string;
    };

type LiveRunRecord = {
  attempt: 1 | 2;
  evaluation: ExtractionEvaluation | null;
  fixtureId: string;
  latencyMs: number;
  mode: AnalyzeMode;
  providerErrorCode: string | null;
  providerRequestId: string | null;
  qualitative: QualitativeReview | null;
  timestamp: string;
  tokenUsage: { input: number; output: number; total: number } | null;
};

function parseGold(mode: AnalyzeMode, serialized: string): AnalyzedLesson {
  const result =
    mode === "chart"
      ? parseChartLessonJson(serialized)
      : parseProcessLessonJson(serialized);
  if (!result.success) {
    throw new Error("A committed gold fixture failed its runtime schema.");
  }
  return result.data;
}

function qualitativeReview(
  mode: AnalyzeMode,
  outputText: string,
): QualitativeReview | null {
  if (mode === "chart") {
    const parsed = parseChartLessonJson(outputText);
    if (!parsed.success) return null;
    return {
      mode,
      reviewItems: parsed.data.reviewItems,
      summary: parsed.data.summary,
      title: parsed.data.title,
      trends: parsed.data.trends,
    };
  }
  const parsed = parseProcessLessonJson(outputText);
  if (!parsed.success) return null;
  return {
    descriptions: parsed.data.nodes.map(({ description, label, status }) => ({
      description,
      label,
      status,
    })),
    mode,
    reviewItems: parsed.data.reviewItems,
    summary: parsed.data.summary,
    title: parsed.data.title,
  };
}

function providerErrorCode(error: unknown): string {
  if (error instanceof AnalysisFailure) return error.code;
  return error instanceof Error ? error.name : "UNKNOWN_ERROR";
}

function aggregate(runs: readonly LiveRunRecord[]) {
  const classes = Object.fromEntries(
    EVALUATION_CLASSES.map((classification) => [classification, 0]),
  ) as Record<EvaluationClass, number>;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let schemaValid = 0;
  let semanticValid = 0;
  let supported = 0;

  runs.forEach((run) => {
    if (run.evaluation) {
      classes[run.evaluation.classification] += 1;
      if (run.evaluation.schemaValid) schemaValid += 1;
      if (run.evaluation.semanticValid) semanticValid += 1;
      if (run.evaluation.supportedActual) supported += 1;
    }
    inputTokens += run.tokenUsage?.input ?? 0;
    outputTokens += run.tokenUsage?.output ?? 0;
    totalTokens += run.tokenUsage?.total ?? 0;
  });

  return {
    callsCompleted: runs.length,
    classes,
    inputTokens,
    meanLatencyMs:
      runs.length === 0
        ? 0
        : Math.round(
            runs.reduce((total, { latencyMs }) => total + latencyMs, 0) /
              runs.length,
          ),
    outputTokens,
    providerErrors: runs.filter(({ providerErrorCode: code }) => code !== null)
      .length,
    schemaValid,
    semanticValid,
    supported,
    totalTokens,
  };
}

async function loadFixture(
  id: string,
  mode: AnalyzeMode,
): Promise<{ gold: AnalyzedLesson; image: ValidatedImage }> {
  const goldText = await readFile(resolve(`fixtures/gold/${id}.json`), "utf8");
  const bytes = await readFile(resolve(`fixtures/images/${id}.png`));
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const image = await validateImageUpload(
    {
      arrayBuffer: async () => arrayBuffer,
      name: `${id}.png`,
      size: bytes.byteLength,
      type: "image/png",
    },
    getUploadConfig(),
  );
  return { gold: parseGold(mode, goldText), image };
}

describe("explicit live GPT-5.6 evaluation gate", () => {
  it("cannot enter the live path without the dedicated command, flag, and key", () => {
    if (invokedLiveEntrypoint) {
      expect(explicitLiveFlag, "Set OPTIQ_RUN_LIVE_EVALS=1 explicitly.").toBe(
        true,
      );
      expect(hasApiKey, "Provide OPENAI_API_KEY through the server-only env file.").toBe(
        true,
      );
    } else {
      expect(
        explicitLiveFlag,
        "Normal tests refuse when the live-evaluation flag is present.",
      ).toBe(false);
    }
  });

  it.runIf(invokedLiveEntrypoint && explicitLiveFlag && hasApiKey)(
    "evaluates six owned fixtures and repeats both demo fixtures without unsafe output",
    async () => {
      const client = new OpenAI({
        maxRetries: 0,
        timeout: PROVIDER_TIMEOUT_MS,
      });
      const provider = createOpenAIProvider(client.responses);
      const safetyIdentifier = `anon_${randomBytes(18).toString("base64url")}`;
      const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();
      const startedAt = new Date().toISOString();
      const runId = startedAt.replace(/[:.]/g, "-");
      const outputDirectory = resolve(".local-eval/task09");
      const plans = [
        ...FIXTURES.map((fixture) => ({ ...fixture, attempt: 1 as const })),
        ...DEMO_FIXTURE_IDS.map((id) => ({
          ...FIXTURES.find((fixture) => fixture.id === id)!,
          attempt: 2 as const,
        })),
      ];
      expect(plans).toHaveLength(MAX_LIVE_CALLS);
      const runs: LiveRunRecord[] = [];
      await mkdir(outputDirectory, { recursive: true });

      const writeSanitizedReport = async (completedAt: string | null) => {
        const report = {
          aggregate: aggregate(runs),
          completedAt,
          configuration: {
            imageDetail: "high",
            maxLiveCalls: MAX_LIVE_CALLS,
            model: "gpt-5.6",
            promptVersion: EXTRACTION_PROMPT_VERSION,
            reasoningEffort: "medium",
            responseSchemas: [
              chartResponseFormat.name,
              processResponseFormat.name,
            ],
            store: false,
          },
          fixtureCount: FIXTURES.length,
          fixtureOwnership: "Optiq project synthetic fixtures, CC0-1.0",
          runs,
          schemaVersion: "1.0",
          sourceRevision,
          startedAt,
        };
        const serialized = `${JSON.stringify(report, null, 2)}\n`;
        await writeFile(resolve(outputDirectory, "latest.json"), serialized, "utf8");
        if (completedAt) {
          await writeFile(
            resolve(outputDirectory, `${runId}.json`),
            serialized,
            "utf8",
          );
        }
      };

      for (const plan of plans) {
        expect(runs.length).toBeLessThan(MAX_LIVE_CALLS);
        const { gold, image } = await loadFixture(plan.id, plan.mode);
        const timestamp = new Date().toISOString();
        const started = performance.now();
        try {
          const extraction = await provider.extract({
            image,
            mode: plan.mode,
            safetyIdentifier,
            signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
          });
          const latencyMs = Math.round(performance.now() - started);
          runs.push({
            attempt: plan.attempt,
            evaluation: evaluateProviderOutput(
              plan.mode,
              gold,
              extraction.outputText,
            ),
            fixtureId: plan.id,
            latencyMs,
            mode: plan.mode,
            providerErrorCode: null,
            providerRequestId: extraction.providerRequestId ?? null,
            qualitative: qualitativeReview(plan.mode, extraction.outputText),
            timestamp,
            tokenUsage: extraction.tokenUsage ?? null,
          });
        } catch (error) {
          runs.push({
            attempt: plan.attempt,
            evaluation: null,
            fixtureId: plan.id,
            latencyMs: Math.round(performance.now() - started),
            mode: plan.mode,
            providerErrorCode: providerErrorCode(error),
            providerRequestId: null,
            qualitative: null,
            timestamp,
            tokenUsage: null,
          });
          await writeSanitizedReport(null);
          break;
        }
        await writeSanitizedReport(null);
      }

      await writeSanitizedReport(new Date().toISOString());
      expect(runs, "The fixed plan must complete without provider errors.").toHaveLength(
        MAX_LIVE_CALLS,
      );
      runs.forEach((run) => {
        expect(run.providerErrorCode, `${run.fixtureId} provider error`).toBeNull();
        expect(run.evaluation?.schemaValid, `${run.fixtureId} schema validity`).toBe(
          true,
        );
        expect(
          run.evaluation?.semanticValid,
          `${run.fixtureId} semantic validity`,
        ).toBe(true);
        expect(run.evaluation?.supportedActual, `${run.fixtureId} support`).toBe(
          true,
        );
        expect(
          ["SAFE_CORRECT", "SAFE_REVIEW"],
          `${run.fixtureId} safe result class`,
        ).toContain(run.evaluation?.classification);
      });
      DEMO_FIXTURE_IDS.forEach((fixtureId) => {
        const demoRuns = runs.filter((run) => run.fixtureId === fixtureId);
        expect(demoRuns, `${fixtureId} consecutive demo evidence`).toHaveLength(2);
        expect(
          demoRuns.every((run) =>
            ["SAFE_CORRECT", "SAFE_REVIEW"].includes(
              run.evaluation?.classification ?? "INVALID_OUTPUT",
            ),
          ),
        ).toBe(true);
      });
    },
    600_000,
  );
});
