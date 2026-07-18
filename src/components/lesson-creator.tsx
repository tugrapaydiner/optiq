"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { ChartLessonView } from "@/components/chart-lesson";
import { ProcessLessonView } from "@/components/process-lesson";
import { TeacherReviewPanel } from "@/components/teacher-review";
import type {
  AnalyzeEnvelope,
  AnalyzeMode,
  PublicAnalysisError,
} from "@/lib/analyze/types";
import type { ChartLesson } from "@/lib/contracts/chart";
import type { ProcessLesson } from "@/lib/contracts/process";
import { CHART_SAMPLES, getChartSample } from "@/lib/samples/chart-samples";
import {
  PROCESS_SAMPLES,
  getProcessSample,
} from "@/lib/samples/process-samples";
import { createTeacherReviewState } from "@/lib/review/state";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  formatUploadLimit,
} from "@/lib/upload/config";
import { SUPPORTED_IMAGE_MIME_TYPES } from "@/lib/upload/shared";

const WORKFLOW_STAGES = ["Source", "Review", "Preview", "Export"] as const;

type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { envelope: AnalyzeEnvelope; status: "finished" };

type LessonCreatorProps = {
  maxUploadBytes?: number;
};

export function WorkflowProgress() {
  return (
    <ol aria-label="Lesson creation progress" className="studio-progress">
      {WORKFLOW_STAGES.map((stage, index) => (
        <li aria-current={index === 0 ? "step" : undefined} key={stage}>
          {stage}
        </li>
      ))}
    </ol>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseEnvelope(value: unknown): AnalyzeEnvelope | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") return null;
  if (typeof value.requestId !== "string") return null;

  if (value.ok) {
    if (
      (value.mode !== "chart" && value.mode !== "process") ||
      (value.provider !== "fixture" && value.provider !== "openai") ||
      !isRecord(value.lesson)
    ) {
      return null;
    }
    return value as AnalyzeEnvelope;
  }

  if (!isRecord(value.error)) return null;
  if (
    typeof value.error.code !== "string" ||
    typeof value.error.message !== "string" ||
    typeof value.error.retryable !== "boolean"
  ) {
    return null;
  }
  return value as AnalyzeEnvelope;
}

function clientFileError(file: File, maxUploadBytes: number): string | null {
  if (!SUPPORTED_IMAGE_MIME_TYPES.some((mimeType) => mimeType === file.type)) {
    return "Choose a PNG, JPEG, or WebP image.";
  }
  if (file.size > maxUploadBytes) {
    return `This image is larger than the configured ${formatUploadLimit(maxUploadBytes)} limit.`;
  }
  if (file.size < 1) return "The selected image is empty.";
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ChartReviewWorkspace({
  headingRef,
  lesson,
  sourceLabel,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  lesson: ChartLesson;
  sourceLabel: string;
}) {
  const [state, setState] = useState(() => createTeacherReviewState(lesson));
  return (
    <div className="review-workspace">
      <TeacherReviewPanel
        headingRef={headingRef}
        mode="chart"
        onChange={setState}
        state={state}
      />
      <div className="review-preview">
        <p className="analysis-message-label">Accessible draft preview</p>
        <ChartLessonView lesson={state.draft} sourceLabel={sourceLabel} />
      </div>
    </div>
  );
}

function ProcessReviewWorkspace({
  headingRef,
  lesson,
  sourceLabel,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  lesson: ProcessLesson;
  sourceLabel: string;
}) {
  const [state, setState] = useState(() => createTeacherReviewState(lesson));
  return (
    <div className="review-workspace">
      <TeacherReviewPanel
        headingRef={headingRef}
        mode="process"
        onChange={setState}
        state={state}
      />
      <div className="review-preview">
        <p className="analysis-message-label">Accessible draft preview</p>
        <ProcessLessonView lesson={state.draft} sourceLabel={sourceLabel} />
      </div>
    </div>
  );
}

function ResultSummary({
  envelope,
  headingRef,
  onRetry,
}: {
  envelope: AnalyzeEnvelope;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
}) {
  if (!envelope.ok) {
    return (
      <div
        className={`analysis-message ${envelope.error.code === "UNSUPPORTED_VISUAL" ? "analysis-message-unsupported" : "analysis-message-error"}`}
      >
        <p className="analysis-message-label">
          {envelope.error.code === "UNSUPPORTED_VISUAL"
            ? "Unsupported or unclear visual"
            : "Analysis could not finish"}
        </p>
        <h3>{envelope.error.message}</h3>
        <p>
          {envelope.error.retryable
            ? "Your selected image is still here, so you can try again."
            : "Choose another image or visual type before trying again."}
        </p>
        {envelope.error.retryable ? (
          <button
            className="button button-secondary analysis-retry"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (envelope.mode === "chart") {
    const lesson = envelope.lesson as ChartLesson;
    return (
      <ChartReviewWorkspace
        headingRef={headingRef}
        lesson={lesson}
        sourceLabel={
          envelope.provider === "fixture" ? "Built-in sample draft" : "Live draft"
        }
      />
    );
  }

  return (
    <ProcessReviewWorkspace
      headingRef={headingRef}
      lesson={envelope.lesson as ProcessLesson}
      sourceLabel={
        envelope.provider === "fixture" ? "Built-in sample draft" : "Live draft"
      }
    />
  );
}

export function LessonCreator({
  maxUploadBytes = DEFAULT_MAX_UPLOAD_BYTES,
}: LessonCreatorProps) {
  const [mode, setMode] = useState<AnalyzeMode>("chart");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sampleId, setSampleId] = useState(CHART_SAMPLES[0]!.id);
  const [processSampleId, setProcessSampleId] = useState(PROCESS_SAMPLES[0]!.id);
  const [requestState, setRequestState] = useState<RequestState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseButtonRef = useRef<HTMLButtonElement>(null);
  const analyzeButtonRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const activeRequest = useRef<{ controller: AbortController; sequence: number } | null>(
    null,
  );
  const sequence = useRef(0);

  useEffect(() => {
    if (requestState.status !== "finished") return;
    if (!requestState.envelope.ok) {
      errorRef.current?.focus();
    } else {
      resultHeadingRef.current?.focus();
    }
  }, [requestState]);

  useEffect(
    () => () => {
      activeRequest.current?.controller.abort();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  function replacePreview(nextFile: File | null): void {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = nextFile ? URL.createObjectURL(nextFile) : null;
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }

  function cancelActiveRequest(): void {
    activeRequest.current?.controller.abort();
    activeRequest.current = null;
  }

  function focusSoon(target: "analyze" | "choose"): void {
    window.setTimeout(() => {
      if (target === "analyze") analyzeButtonRef.current?.focus();
      else chooseButtonRef.current?.focus();
    }, 0);
  }

  function chooseFile(
    nextFile: File | undefined,
    restorePickerFocus = false,
  ): void {
    cancelActiveRequest();
    setRequestState({ status: "idle" });
    if (!nextFile) return;

    const error = clientFileError(nextFile, maxUploadBytes);
    setFileError(error);
    setFile(error ? null : nextFile);
    replacePreview(error ? null : nextFile);
    if (error && inputRef.current) inputRef.current.value = "";
    if (restorePickerFocus) focusSoon(error ? "choose" : "analyze");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>): void {
    chooseFile(event.target.files?.[0], true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    chooseFile(event.dataTransfer.files[0]);
  }

  function removeFile(): void {
    cancelActiveRequest();
    setFile(null);
    replacePreview(null);
    setFileError(null);
    setRequestState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
    focusSoon("choose");
  }

  function openChartSample(): void {
    cancelActiveRequest();
    const sample = getChartSample(sampleId);
    setMode("chart");
    setFile(null);
    replacePreview(null);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
    setRequestState({
      envelope: {
        lesson: sample.lesson,
        mode: "chart",
        ok: true,
        provider: "fixture",
        requestId: `sample_${sample.id}`,
      },
      status: "finished",
    });
  }

  function openProcessSample(): void {
    cancelActiveRequest();
    const sample = getProcessSample(processSampleId);
    setMode("process");
    setFile(null);
    replacePreview(null);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
    setRequestState({
      envelope: {
        lesson: sample.lesson,
        mode: "process",
        ok: true,
        provider: "fixture",
        requestId: `sample_${sample.id}`,
      },
      status: "finished",
    });
  }

  async function analyze(): Promise<void> {
    if (!file || requestState.status === "loading") return;

    cancelActiveRequest();
    const controller = new AbortController();
    const currentSequence = ++sequence.current;
    activeRequest.current = { controller, sequence: currentSequence };
    setRequestState({ status: "loading" });

    const formData = new FormData();
    formData.set("mode", mode);
    formData.set("file", file, file.name);

    try {
      const response = await fetch("/api/analyze", {
        body: formData,
        method: "POST",
        signal: controller.signal,
      });
      const parsed = parseEnvelope(await response.json());
      if (activeRequest.current?.sequence !== currentSequence) return;
      if (parsed === null) {
        const fallbackError: PublicAnalysisError = {
          code: "INTERNAL_ERROR",
          message: "Optiq received an unreadable analysis response. Try again shortly.",
          retryable: true,
        };
        setRequestState({
          envelope: {
            error: fallbackError,
            ok: false,
            requestId: "unavailable",
          },
          status: "finished",
        });
      } else {
        setRequestState({ envelope: parsed, status: "finished" });
      }
    } catch {
      if (controller.signal.aborted || activeRequest.current?.sequence !== currentSequence) {
        return;
      }
      setRequestState({
        envelope: {
          error: {
            code: "PROVIDER_UNAVAILABLE",
            message: "Optiq could not reach the analysis service. Try again shortly.",
            retryable: true,
          },
          ok: false,
          requestId: "unavailable",
        },
        status: "finished",
      });
    } finally {
      if (activeRequest.current?.sequence === currentSequence) {
        activeRequest.current = null;
      }
    }
  }

  const resultIsError =
    requestState.status === "finished" && !requestState.envelope.ok;

  return (
    <div aria-busy={requestState.status === "loading"} className="studio-workspace">
      <div className="studio-source-grid">
        <section aria-labelledby="visual-type-heading" className="source-kind">
          <div className="studio-step-heading source-kind-heading">
            <div>
              <h2 id="visual-type-heading">Visual type</h2>
              <p>Choose what students need to explore.</p>
            </div>
            <div className="sample-picker">
              <span className="sample-picker-note">Sample · no API</span>
              <div className="sample-picker-controls">
                {mode === "chart" ? (
                  <>
                    <label className="visually-hidden" htmlFor="chart-sample">
                      Built-in chart
                    </label>
                    <select
                      id="chart-sample"
                      onChange={(event) => setSampleId(event.target.value)}
                      value={sampleId}
                    >
                      {CHART_SAMPLES.map((sample) => (
                        <option key={sample.id} value={sample.id}>
                          {sample.label} — {sample.description}
                        </option>
                      ))}
                    </select>
                    <button
                      className="text-action sample-open"
                      onClick={openChartSample}
                      type="button"
                    >
                      Open
                    </button>
                  </>
                ) : (
                  <>
                    <label className="visually-hidden" htmlFor="process-sample">
                      Built-in process
                    </label>
                    <select
                      id="process-sample"
                      onChange={(event) => setProcessSampleId(event.target.value)}
                      value={processSampleId}
                    >
                      {PROCESS_SAMPLES.map((sample) => (
                        <option key={sample.id} value={sample.id}>
                          {sample.label} — {sample.description}
                        </option>
                      ))}
                    </select>
                    <button
                      className="text-action sample-open"
                      onClick={openProcessSample}
                      type="button"
                    >
                      Open
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <fieldset>
            <legend>Visual type</legend>
            <div className="source-choice-list">
              <label className="source-choice">
                <input
                  checked={mode === "chart"}
                  className="visually-hidden"
                  name="mode"
                  onChange={() => {
                    cancelActiveRequest();
                    setMode("chart");
                    setRequestState({ status: "idle" });
                  }}
                  type="radio"
                  value="chart"
                />
                <span aria-hidden="true" className="source-choice-mark" />
                <span className="source-choice-copy">
                  <span className="source-choice-title">Chart</span>
                  <span className="source-choice-detail">
                    Bar or line chart with labelled numeric values.
                  </span>
                </span>
              </label>

              <label className="source-choice">
                <input
                  checked={mode === "process"}
                  className="visually-hidden"
                  name="mode"
                  onChange={() => {
                    cancelActiveRequest();
                    setMode("process");
                    setRequestState({ status: "idle" });
                  }}
                  type="radio"
                  value="process"
                />
                <span aria-hidden="true" className="source-choice-mark" />
                <span className="source-choice-copy">
                  <span className="source-choice-title">Process diagram</span>
                  <span className="source-choice-detail">
                    Labelled steps connected in a meaningful order.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

        </section>

        <section aria-labelledby="upload-heading" className="source-upload">
          <div className="studio-step-heading">
            <h2 id="upload-heading">Source image</h2>
            <p>One clear PNG, JPEG, or WebP.</p>
          </div>

          <label className="visually-hidden" htmlFor="visual-file">
            Image file
          </label>
          <input
            accept="image/png,image/jpeg,image/webp"
            aria-describedby={`upload-help${fileError ? " upload-error" : ""}`}
            className="visually-hidden"
            id="visual-file"
            onChange={onFileChange}
            ref={inputRef}
            tabIndex={-1}
            type="file"
          />

          {file && previewUrl ? (
            <div className="upload-selected">
              <div className="upload-preview">
                <Image
                  alt="Preview of the selected source image"
                  height={600}
                  src={previewUrl}
                  unoptimized
                  width={800}
                />
              </div>
              <div className="upload-selected-copy">
                <strong>{file.name}</strong>
                <span>{formatFileSize(file.size)}</span>
              </div>
              <div className="upload-selected-actions">
                <button
                  className="text-action"
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  Replace
                </button>
                <button className="text-action" onClick={removeFile} type="button">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              className="upload-editorial upload-editorial-active"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <span aria-hidden="true" className="upload-symbol">
                +
              </span>
              <div className="upload-copy">
                <strong>Drop an image here</strong>
                <span id="upload-help">
                  PNG, JPEG, or WebP · Up to {formatUploadLimit(maxUploadBytes)}
                </span>
              </div>
              <button
                className="upload-choice"
                onClick={() => inputRef.current?.click()}
                ref={chooseButtonRef}
                type="button"
              >
                Choose a file
              </button>
            </div>
          )}

          {fileError ? (
            <p className="upload-error" id="upload-error" role="alert">
              {fileError}
            </p>
          ) : null}

          <div className="studio-actionbar">
            <button
              className="button button-primary"
              disabled={!file || requestState.status === "loading"}
              onClick={analyze}
              ref={analyzeButtonRef}
              type="button"
            >
              {requestState.status === "loading" ? "Analyzing…" : "Analyze source"}
            </button>
            <p aria-live="polite" className="analysis-status" role="status">
              {requestState.status === "loading"
                ? "Reading visible structure. This may take up to one minute."
                : file
                  ? "Ready to analyze this image."
                  : "Add a valid image to continue."}
            </p>
          </div>
        </section>
      </div>

      {requestState.status === "finished" ? (
        <section aria-label="Analysis result" className="analysis-result">
          {resultIsError ? (
            <h2 className="visually-hidden" ref={errorRef} tabIndex={-1}>
              Analysis error
            </h2>
          ) : null}
          <ResultSummary
            envelope={requestState.envelope}
            headingRef={resultHeadingRef}
            key={requestState.envelope.requestId}
            onRetry={analyze}
          />
        </section>
      ) : null}

      <div className="studio-notes">
        <p>
          <strong>Teacher review is required before export.</strong>
        </p>
        <p id="privacy">
          Your image is sent to OpenAI for analysis. Optiq does not intentionally
          save uploaded images in its application. It uses an opaque functional
          session cookie for abuse attribution, not an account or identity. Avoid
          sensitive or student-identifying content. OpenAI&apos;s current API data
          controls apply.
        </p>
      </div>
    </div>
  );
}
