"use client";

import { useState, type Ref } from "react";

import type { ChartLesson } from "@/lib/contracts/chart";
import type { ReviewItem } from "@/lib/contracts/common";
import type { ProcessLesson } from "@/lib/contracts/process";
import { downloadStandaloneExport } from "@/lib/export/download";
import { createStandaloneExport } from "@/lib/export/standalone";
import {
  REVIEW_ACKNOWLEDGEMENT,
  exportEligibility,
  getTargetValue,
  moveReadingOrder,
  reopenReviewItem,
  resolveReviewItem,
  reviewSummary,
  setReviewerAcknowledged,
  updateNumberField,
  updateProcessEdgeEndpoint,
  updateTextField,
  type ReviewLesson,
  type ReviewMode,
  type TeacherReviewState,
} from "@/lib/review/state";

type TeacherReviewPanelProps =
  | {
      headingRef?: Ref<HTMLHeadingElement>;
      mode: "chart";
      onChange: (state: TeacherReviewState<ChartLesson>) => void;
      state: TeacherReviewState<ChartLesson>;
    }
  | {
      headingRef?: Ref<HTMLHeadingElement>;
      mode: "process";
      onChange: (state: TeacherReviewState<ProcessLesson>) => void;
      state: TeacherReviewState<ProcessLesson>;
    };

type FieldKind = "number" | "text" | "textarea";

type FieldDescriptor = {
  kind: FieldKind;
  label: string;
  path: string;
};

function fieldDomId(prefix: string, path: string): string {
  return `${prefix}-${path.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "")}`;
}

function valueText(value: string | number | null | undefined): string {
  if (value === null) return "Not provided";
  if (value === undefined) return "Unavailable";
  return String(value);
}

function fieldDescriptors(lesson: ReviewLesson): FieldDescriptor[] {
  const common: FieldDescriptor[] = [
    { kind: "text", label: "Lesson title", path: "/title" },
    { kind: "textarea", label: "Lesson summary", path: "/summary" },
  ];
  if ("chartType" in lesson) {
    return [
      ...common,
      { kind: "text", label: "Horizontal axis label", path: "/xAxis/label" },
      { kind: "text", label: "Horizontal axis unit", path: "/xAxis/unit" },
      { kind: "text", label: "Vertical axis label", path: "/yAxis/label" },
      { kind: "text", label: "Vertical axis unit", path: "/yAxis/unit" },
      ...lesson.series.flatMap((series) => [
        {
          kind: "text" as const,
          label: `${series.label} — series label`,
          path: `/series/${series.id}/label`,
        },
        ...series.points.flatMap((point) => [
          {
            kind: "text" as const,
            label: `${series.label} — ${point.xLabel} — category label`,
            path: `/series/${series.id}/points/${point.id}/xLabel`,
          },
          {
            kind: "number" as const,
            label: `${series.label} — ${point.xLabel} — numeric value`,
            path: `/series/${series.id}/points/${point.id}/value`,
          },
          {
            kind: "text" as const,
            label: `${series.label} — ${point.xLabel} — displayed value`,
            path: `/series/${series.id}/points/${point.id}/displayValue`,
          },
        ]),
      ]),
      ...lesson.trends.map((trend, index) => ({
        kind: "textarea" as const,
        label: `Trend ${index + 1}`,
        path: `/trends/${trend.id}/text`,
      })),
    ];
  }
  return [
    ...common,
    ...lesson.nodes.flatMap((node) => [
      {
        kind: "text" as const,
        label: `${node.label} — node label`,
        path: `/nodes/${node.id}/label`,
      },
      {
        kind: "textarea" as const,
        label: `${node.label} — node description`,
        path: `/nodes/${node.id}/description`,
      },
    ]),
    ...lesson.edges.map((edge, index) => ({
      kind: "text" as const,
      label: `Connection ${index + 1} — optional label`,
      path: `/edges/${edge.id}/label`,
    })),
  ];
}

function FieldInput<TLesson extends ReviewLesson>({
  descriptor,
  id,
  onChange,
  state,
}: {
  descriptor: FieldDescriptor;
  id: string;
  onChange: (state: TeacherReviewState<TLesson>) => void;
  state: TeacherReviewState<TLesson>;
}) {
  const current = getTargetValue(state.draft, descriptor.path);
  const inputValue =
    state.rawValues[descriptor.path] ??
    (current === null || current === undefined ? "" : String(current));
  const error = state.fieldErrors[descriptor.path];
  const errorId = `${id}-error`;
  const shared = {
    "aria-describedby": error ? errorId : undefined,
    id,
    name: id,
    value: inputValue,
  };

  return (
    <div className="review-field">
      <label htmlFor={id}>{descriptor.label}</label>
      {descriptor.kind === "textarea" ? (
        <textarea
          {...shared}
          onChange={(event) =>
            onChange(updateTextField(state, descriptor.path, event.target.value))
          }
          rows={3}
        />
      ) : (
        <input
          {...shared}
          inputMode={descriptor.kind === "number" ? "decimal" : undefined}
          onChange={(event) =>
            onChange(
              descriptor.kind === "number"
                ? updateNumberField(state, descriptor.path, event.target.value)
                : updateTextField(state, descriptor.path, event.target.value),
            )
          }
          type="text"
        />
      )}
      {error ? (
        <p className="review-field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ReviewItemCard<TLesson extends ReviewLesson>({
  descriptor,
  item,
  mode,
  onAnnounce,
  onChange,
  processNodes,
  state,
}: {
  descriptor?: FieldDescriptor;
  item: ReviewItem;
  mode: ReviewMode;
  onAnnounce: (message: string) => void;
  onChange: (state: TeacherReviewState<TLesson>) => void;
  processNodes?: ProcessLesson["nodes"];
  state: TeacherReviewState<TLesson>;
}) {
  const headingId = `review-item-${item.id}`;
  const fieldId = `review-field-${item.id}`;
  const resolved = state.resolvedReviewItemIds.includes(item.id);
  const originalValue = getTargetValue(state.original, item.targetPath);
  const currentValue = getTargetValue(state.draft, item.targetPath);
  const edgeMatch = item.targetPath.match(
    /^\/edges\/([a-z0-9][a-z0-9_-]*)\/(from|to)$/,
  );

  function resolve(): void {
    const result = resolveReviewItem(state, item.id, mode);
    onChange(result.state);
    onAnnounce(result.message);
    if (!result.accepted) {
      document.getElementById(fieldId)?.focus();
    }
  }

  return (
    <article className="review-item" data-severity={item.severity}>
      <div className="review-item-heading">
        <div>
          <p className="review-severity">
            {item.severity === "critical" ? "Critical" : "Warning"} ·{" "}
            {item.status.replaceAll("_", " ")}
          </p>
          <h4 id={headingId} tabIndex={-1}>
            {descriptor?.label ?? item.targetPath}
          </h4>
        </div>
        <span className="review-resolution-state">
          {resolved ? "Resolved" : "Needs review"}
        </span>
      </div>
      <p className="review-item-message">{item.message}</p>
      <dl className="review-comparison">
        <div>
          <dt>Original</dt>
          <dd>{valueText(originalValue)}</dd>
        </div>
        <div>
          <dt>Current draft</dt>
          <dd>{valueText(currentValue)}</dd>
        </div>
      </dl>

      {edgeMatch && processNodes ? (
        <div className="review-field">
          <label htmlFor={fieldId}>{descriptor?.label ?? "Connected node"}</label>
          <select
            aria-describedby={
              state.fieldErrors[item.targetPath]
                ? `${fieldId}-error`
                : undefined
            }
            id={fieldId}
            onChange={(event) => {
              const next = updateProcessEdgeEndpoint(
                state as TeacherReviewState<ProcessLesson>,
                edgeMatch[1]!,
                edgeMatch[2] as "from" | "to",
                event.target.value,
              );
              onChange(next as TeacherReviewState<TLesson>);
            }}
            value={String(currentValue ?? "")}
          >
            {processNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label}
              </option>
            ))}
          </select>
          {state.fieldErrors[item.targetPath] ? (
            <p className="review-field-error" id={`${fieldId}-error`}>
              {state.fieldErrors[item.targetPath]}
            </p>
          ) : null}
        </div>
      ) : descriptor ? (
        <FieldInput
          descriptor={descriptor}
          id={fieldId}
          onChange={onChange}
          state={state}
        />
      ) : (
        <p className="review-readonly-note">
          Confirm this extracted status using the draft preview and source image.
        </p>
      )}

      <div className="review-item-actions">
        {resolved ? (
          <button
            className="text-action"
            onClick={() => {
              onChange(reopenReviewItem(state, item.id));
              onAnnounce("Review item reopened.");
            }}
            type="button"
          >
            Reopen
          </button>
        ) : (
          <button className="button button-secondary" onClick={resolve} type="button">
            Mark resolved
          </button>
        )}
      </div>
    </article>
  );
}

function OtherFieldsEditor<TLesson extends ReviewLesson>({
  onChange,
  state,
}: {
  onChange: (state: TeacherReviewState<TLesson>) => void;
  state: TeacherReviewState<TLesson>;
}) {
  const reviewPaths = new Set(
    state.draft.reviewItems.map(({ targetPath }) => targetPath),
  );
  const descriptors = fieldDescriptors(state.draft).filter(
    ({ path }) => !reviewPaths.has(path),
  );

  return (
    <details className="review-details">
      <summary>Review other lesson fields</summary>
      <p>
        Correct an unflagged label or fact here. Every change is tracked and
        clears the final acknowledgment.
      </p>
      <div className="review-field-grid">
        {descriptors.map((descriptor) => (
          <FieldInput
            descriptor={descriptor}
            id={fieldDomId("review-other", descriptor.path)}
            key={descriptor.path}
            onChange={onChange}
            state={state}
          />
        ))}
      </div>
    </details>
  );
}

function ProcessStructureEditor({
  onAnnounce,
  onChange,
  state,
}: {
  onAnnounce: (message: string) => void;
  onChange: (state: TeacherReviewState<ProcessLesson>) => void;
  state: TeacherReviewState<ProcessLesson>;
}) {
  const nodeById = new Map(state.draft.nodes.map((node) => [node.id, node]));
  const originalNodeById = new Map(
    state.original.nodes.map((node) => [node.id, node]),
  );
  return (
    <details className="review-details">
      <summary>Review connections and reading order</summary>
      <p>
        Connection endpoints use existing nodes only. Move buttons preserve every
        node exactly once.
      </p>
      <div className="review-edge-list">
        {state.draft.edges.map((edge, index) => (
          <fieldset key={edge.id}>
            <legend>Connection {index + 1}</legend>
            {(["from", "to"] as const).map((endpoint) => {
              const path = `/edges/${edge.id}/${endpoint}`;
              const id = fieldDomId(`review-edge-${edge.id}`, endpoint);
              return (
                <div className="review-field" key={endpoint}>
                  <label htmlFor={id}>
                    {endpoint === "from" ? "From node" : "To node"}
                  </label>
                  <select
                    aria-describedby={
                      state.fieldErrors[path] ? `${id}-error` : undefined
                    }
                    id={id}
                    onChange={(event) =>
                      onChange(
                        updateProcessEdgeEndpoint(
                          state,
                          edge.id,
                          endpoint,
                          event.target.value,
                        ),
                      )
                    }
                    value={edge[endpoint]}
                  >
                    {state.draft.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                  {state.fieldErrors[path] ? (
                    <p className="review-field-error" id={`${id}-error`}>
                      {state.fieldErrors[path]}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>

      <div className="review-order">
        <h4>Reading order</h4>
        <p>
          Original: {state.original.readingOrder
            .map((id) => originalNodeById.get(id)?.label)
            .join(" → ")}
        </p>
        <ol>
          {state.draft.readingOrder.map((nodeId, index) => (
            <li key={nodeId}>
              <span>
                {index + 1}. {nodeById.get(nodeId)?.label}
              </span>
              <span className="review-order-actions">
                <button
                  className="text-action"
                  disabled={index === 0}
                  onClick={() => {
                    onChange(moveReadingOrder(state, nodeId, "up"));
                    onAnnounce(`${nodeById.get(nodeId)?.label} moved up.`);
                  }}
                  type="button"
                >
                  Move up
                </button>
                <button
                  className="text-action"
                  disabled={index === state.draft.readingOrder.length - 1}
                  onClick={() => {
                    onChange(moveReadingOrder(state, nodeId, "down"));
                    onAnnounce(`${nodeById.get(nodeId)?.label} moved down.`);
                  }}
                  type="button"
                >
                  Move down
                </button>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

function ReviewPanelLayout<TLesson extends ReviewLesson>({
  additionalEditor,
  headingRef,
  mode,
  onAnnounce,
  onChange,
  onExport,
  state,
}: {
  additionalEditor?: React.ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  mode: ReviewMode;
  onAnnounce: (message: string) => void;
  onChange: (state: TeacherReviewState<TLesson>) => void;
  onExport: () => void;
  state: TeacherReviewState<TLesson>;
}) {
  const descriptors = new Map(
    fieldDescriptors(state.draft).map((descriptor) => [
      descriptor.path,
      descriptor,
    ]),
  );
  const critical = state.draft.reviewItems.filter(
    ({ severity }) => severity === "critical",
  );
  const warnings = state.draft.reviewItems.filter(
    ({ severity }) => severity === "warning",
  );
  const summary = reviewSummary(state);
  const eligibility = exportEligibility(state, mode);

  function focusBlocker(event: React.MouseEvent<HTMLAnchorElement>): void {
    if (eligibility.allowed || !eligibility.focusTarget) return;
    event.preventDefault();
    document.getElementById(eligibility.focusTarget)?.focus();
  }

  function group(title: string, items: ReviewItem[]) {
    return (
      <section className="review-group" aria-labelledby={`review-${title.toLowerCase()}-heading`}>
        <div className="review-group-heading">
          <h3 id={`review-${title.toLowerCase()}-heading`}>{title}</h3>
          <span>{items.length}</span>
        </div>
        {items.length === 0 ? (
          <p className="review-empty">No {title.toLowerCase()} items.</p>
        ) : (
          <div className="review-item-list">
            {items.map((item) => (
              <ReviewItemCard
                descriptor={descriptors.get(item.targetPath)}
                item={item}
                key={item.id}
                mode={mode}
                onAnnounce={onAnnounce}
                onChange={onChange}
                processNodes={
                  "nodes" in state.draft ? state.draft.nodes : undefined
                }
                state={state}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="teacher-review-heading" className="teacher-review">
      <header className="teacher-review-intro">
        <p className="analysis-message-label">Teacher verification</p>
        <h2 id="teacher-review-heading" ref={headingRef} tabIndex={-1}>
          Review the extracted lesson
        </h2>
        <p>
          Compare the original extraction with the editable draft. Editing does
          not resolve an item; teacher confirmation is always explicit.
        </p>
      </header>

      <dl className="review-summary">
        <div>
          <dt>Unresolved critical</dt>
          <dd>{summary.unresolvedCritical}</dd>
        </div>
        <div>
          <dt>Warnings</dt>
          <dd>{summary.warnings}</dd>
        </div>
        <div>
          <dt>Modified fields</dt>
          <dd>{summary.modifiedFields}</dd>
        </div>
        <div>
          <dt>Teacher acknowledgment</dt>
          <dd>{state.reviewerAcknowledged ? "Checked" : "Not checked"}</dd>
        </div>
      </dl>

      <div
        className="review-eligibility"
        data-allowed={eligibility.allowed}
        id="review-errors"
        tabIndex={-1}
      >
        <h3>{eligibility.allowed ? "Review complete" : "Export is blocked"}</h3>
        {eligibility.allowed ? (
          <p>The draft is valid and eligible for the standalone export step.</p>
        ) : (
          <>
            <ul>
              {eligibility.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {eligibility.focusTarget ? (
              <a href={`#${eligibility.focusTarget}`} onClick={focusBlocker}>
                Go to the first blocker
              </a>
            ) : null}
          </>
        )}
      </div>

      {group("Critical", critical)}
      {group("Warnings", warnings)}
      <p className="review-warning-policy">
        Warnings remain visible and are covered by the final acknowledgment; they
        do not block eligibility on their own.
      </p>

      <OtherFieldsEditor onChange={onChange} state={state} />
      {additionalEditor}

      <div className="review-acknowledgement" id="review-acknowledgement" tabIndex={-1}>
        <label>
          <input
            checked={state.reviewerAcknowledged}
            onChange={(event) => {
              onChange(setReviewerAcknowledged(state, event.target.checked));
              onAnnounce(
                event.target.checked
                  ? "Teacher acknowledgment checked."
                  : "Teacher acknowledgment cleared.",
              );
            }}
            type="checkbox"
          />
          <span>{REVIEW_ACKNOWLEDGEMENT}</span>
        </label>
        <p>
          This confirms a human review. It is not an accessibility certification.
        </p>
      </div>

      <div className="review-export-placeholder">
        <button
          className="button button-primary"
          disabled={!eligibility.allowed}
          onClick={onExport}
          type="button"
        >
          Export lesson
        </button>
        <p>
          {eligibility.allowed
            ? "Download one self-contained HTML lesson. The source image is excluded."
            : "Resolve every reason above before a standalone lesson can be downloaded."}
        </p>
      </div>
    </section>
  );
}

export function TeacherReviewPanel(props: TeacherReviewPanelProps) {
  const [announcement, setAnnouncement] = useState("");
  if (props.mode === "chart") {
    return (
      <>
        <ReviewPanelLayout
          headingRef={props.headingRef}
          mode="chart"
          onAnnounce={setAnnouncement}
          onChange={props.onChange}
          onExport={() => {
            const artifact = createStandaloneExport(props.state, "chart");
            downloadStandaloneExport(artifact);
            setAnnouncement(`Downloaded ${artifact.filename}.`);
          }}
          state={props.state}
        />
        <p
          aria-atomic="true"
          aria-live="polite"
          className="visually-hidden"
          data-testid="review-announcement"
        >
          {announcement}
        </p>
      </>
    );
  }

  return (
    <>
      <ReviewPanelLayout
        additionalEditor={
          <ProcessStructureEditor
            onAnnounce={setAnnouncement}
            onChange={props.onChange}
            state={props.state}
          />
        }
        headingRef={props.headingRef}
        mode="process"
        onAnnounce={setAnnouncement}
        onChange={props.onChange}
        onExport={() => {
          const artifact = createStandaloneExport(props.state, "process");
          downloadStandaloneExport(artifact);
          setAnnouncement(`Downloaded ${artifact.filename}.`);
        }}
        state={props.state}
      />
      <p
        aria-atomic="true"
        aria-live="polite"
        className="visually-hidden"
        data-testid="review-announcement"
      >
        {announcement}
      </p>
    </>
  );
}
