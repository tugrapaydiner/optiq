"use client";

import {
  useId,
  useState,
  type MouseEvent,
  type Ref,
} from "react";

import type { ReviewStatus } from "@/lib/contracts/common";
import type {
  ProcessEdge,
  ProcessLesson,
  ProcessNode,
} from "@/lib/contracts/process";

type ProcessLessonViewProps = {
  headingRef?: Ref<HTMLHeadingElement>;
  lesson: ProcessLesson;
  sourceLabel: string;
};

const STATUS_LABELS: Readonly<Record<ReviewStatus, string>> = {
  unclear: "Unclear",
  inferred_from_layout: "Inferred from layout",
  verified_visible_text: "Verified visible text",
};

type ProcessStructure = {
  hasBranch: boolean;
  hasCycle: boolean;
  loopEdgeIds: ReadonlySet<string>;
};

function nodeHeadingId(nodeId: string): string {
  return `process-node-${nodeId}`;
}

function processStructure(lesson: ProcessLesson): ProcessStructure {
  const outgoingCounts = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  lesson.nodes.forEach(({ id }) => adjacency.set(id, []));
  lesson.edges.forEach(({ from, to }) => {
    outgoingCounts.set(from, (outgoingCounts.get(from) ?? 0) + 1);
    adjacency.get(from)?.push(to);
  });

  function canReach(startId: string, targetId: string): boolean {
    const pending = [startId];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const nodeId = pending.pop()!;
      if (nodeId === targetId) return true;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      pending.push(...(adjacency.get(nodeId) ?? []));
    }
    return false;
  }

  const orderIndex = new Map(
    lesson.readingOrder.map((nodeId, index) => [nodeId, index] as const),
  );
  const cycleEdgeIds = new Set(
    lesson.edges
      .filter(({ from, to }) => canReach(to, from))
      .map(({ id }) => id),
  );
  const returnEdgeIds = new Set(
    lesson.edges
      .filter(
        ({ from, id, to }) =>
          cycleEdgeIds.has(id) &&
          (orderIndex.get(to) ?? 0) <= (orderIndex.get(from) ?? 0),
      )
      .map(({ id }) => id),
  );

  return {
    hasBranch: [...outgoingCounts.values()].some((count) => count > 1),
    hasCycle: cycleEdgeIds.size > 0,
    loopEdgeIds: returnEdgeIds,
  };
}

function structureName({ hasBranch, hasCycle }: ProcessStructure): string {
  if (hasBranch && hasCycle) return "Branching cycle";
  if (hasCycle) return "Cycle";
  if (hasBranch) return "Branching process";
  return "Directed process";
}

function StructureNote({ structure }: { structure: ProcessStructure }) {
  if (structure.hasBranch && structure.hasCycle) {
    return (
      <p className="process-structure-note">
        This process branches and loops. The reading order provides a narration
        start; every branch and return connection is listed below.
      </p>
    );
  }
  if (structure.hasCycle) {
    return (
      <p className="process-structure-note">
        This process repeats. The reading order provides a narration start, but
        the last listed node is not an ending: a connection loops back.
      </p>
    );
  }
  if (structure.hasBranch) {
    return (
      <p className="process-structure-note">
        This process branches. Every outgoing choice is listed; the reading
        order does not imply that there is only one next step.
      </p>
    );
  }
  return (
    <p className="process-structure-note">
      This process follows directed connections from its reading start to an end
      point.
    </p>
  );
}

type ConnectionListProps = {
  direction: "incoming" | "outgoing";
  edges: readonly ProcessEdge[];
  loopEdgeIds: ReadonlySet<string>;
  nodeById: ReadonlyMap<string, ProcessNode>;
};

function ConnectionList({
  direction,
  edges,
  loopEdgeIds,
  nodeById,
}: ConnectionListProps) {
  const title = direction === "incoming" ? "Incoming connections" : "Outgoing connections";

  if (edges.length === 0) {
    return (
      <div className="process-connections">
        <p className="process-connection-heading">{title}</p>
        <p className="process-connection-empty">
          {direction === "incoming"
            ? "None. This is a starting point in the directed process."
            : "None. This is an end point in the directed process."}
        </p>
      </div>
    );
  }

  return (
    <div className="process-connections">
      <p className="process-connection-heading">{title}</p>
      <ul>
        {edges.map((edge) => {
          const relatedNodeId = direction === "incoming" ? edge.from : edge.to;
          const relatedNode = nodeById.get(relatedNodeId)!;
          const isLoop = loopEdgeIds.has(edge.id);
          const prefix =
            direction === "incoming"
              ? isLoop
                ? "Loop arrives from"
                : edges.length > 1
                  ? "Converges from"
                  : "Arrives from"
              : isLoop
                ? "Loops back to"
                : edges.length > 1
                  ? "Branch option"
                  : "Leads to";

          function focusTarget(event: MouseEvent<HTMLAnchorElement>): void {
            event.preventDefault();
            document.getElementById(nodeHeadingId(relatedNodeId))?.focus();
          }

          return (
            <li key={edge.id}>
              <a
                href={`#${nodeHeadingId(relatedNodeId)}`}
                onClick={focusTarget}
              >
                {prefix}: {relatedNode.label}
              </a>
              {edge.label ? <span> — {edge.label}</span> : null}
              <span className="process-connection-status">
                Connection provenance: {STATUS_LABELS[edge.status]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NodeConnections({
  lesson,
  loopEdgeIds,
  node,
  nodeById,
}: {
  lesson: ProcessLesson;
  loopEdgeIds: ReadonlySet<string>;
  node: ProcessNode;
  nodeById: ReadonlyMap<string, ProcessNode>;
}) {
  return (
    <div className="process-node-connections">
      <ConnectionList
        direction="incoming"
        edges={lesson.edges.filter(({ to }) => to === node.id)}
        loopEdgeIds={loopEdgeIds}
        nodeById={nodeById}
      />
      <ConnectionList
        direction="outgoing"
        edges={lesson.edges.filter(({ from }) => from === node.id)}
        loopEdgeIds={loopEdgeIds}
        nodeById={nodeById}
      />
    </div>
  );
}

function ProcessExplorer({
  lesson,
  loopEdgeIds,
  nodeById,
  orderedNodes,
}: {
  lesson: ProcessLesson;
  loopEdgeIds: ReadonlySet<string>;
  nodeById: ReadonlyMap<string, ProcessNode>;
  orderedNodes: readonly ProcessNode[];
}) {
  const headingId = useId();
  const [nodeIndex, setNodeIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const currentNode = orderedNodes[nodeIndex]!;

  function selectNode(nextIndex: number): void {
    if (nextIndex < 0 || nextIndex >= orderedNodes.length) return;
    setNodeIndex(nextIndex);
    const nextNode = orderedNodes[nextIndex]!;
    setAnnouncement(
      `${nextNode.label}, node ${nextIndex + 1} of ${orderedNodes.length}`,
    );
  }

  return (
    <section aria-labelledby={headingId} className="process-explorer">
      <div className="process-explorer-heading">
        <div>
          <p className="chart-section-label">Keyboard explorer</p>
          <h3 id={headingId}>Explore one node at a time</h3>
        </div>
        <p className="process-position">
          Node {nodeIndex + 1} of {orderedNodes.length}
        </p>
      </div>

      <div className="process-current-node">
        <p className="process-current-label">{currentNode.label}</p>
        <p>{currentNode.description}</p>
        <span className="process-provenance">
          Node provenance: {STATUS_LABELS[currentNode.status]}
        </span>
      </div>

      <NodeConnections
        lesson={lesson}
        loopEdgeIds={loopEdgeIds}
        node={currentNode}
        nodeById={nodeById}
      />

      <div className="point-controls">
        <button
          className="button button-secondary"
          disabled={nodeIndex === 0}
          onClick={() => selectNode(nodeIndex - 1)}
          type="button"
        >
          Previous node
        </button>
        <button
          className="button button-secondary"
          disabled={nodeIndex === orderedNodes.length - 1}
          onClick={() => selectNode(nodeIndex + 1)}
          type="button"
        >
          Next node
        </button>
      </div>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="visually-hidden"
        data-testid="process-announcement"
      >
        {announcement}
      </p>
    </section>
  );
}

export function ProcessLessonView({
  headingRef,
  lesson,
  sourceLabel,
}: ProcessLessonViewProps) {
  if (!lesson.supported || lesson.nodes.length === 0) return null;

  const nodeById = new Map(lesson.nodes.map((node) => [node.id, node]));
  const orderedNodes = lesson.readingOrder.map((nodeId) => nodeById.get(nodeId)!);
  const structure = processStructure(lesson);

  return (
    <figure className="process-lesson">
      <figcaption className="process-lesson-intro">
        <p className="analysis-message-label">{sourceLabel}</p>
        <h2 ref={headingRef} tabIndex={-1}>
          {lesson.title}
        </h2>
        <p className="process-summary">{lesson.summary}</p>
      </figcaption>

      <dl className="process-context">
        <div>
          <dt>Structure</dt>
          <dd>{structureName(structure)}</dd>
        </div>
        <div>
          <dt>Nodes</dt>
          <dd>{lesson.nodes.length}</dd>
        </div>
        <div>
          <dt>Connections</dt>
          <dd>{lesson.edges.length}</dd>
        </div>
        <div>
          <dt>Review items</dt>
          <dd>{lesson.reviewItems.length}</dd>
        </div>
      </dl>
      <StructureNote structure={structure} />

      <section aria-labelledby="process-order-heading" className="process-order">
        <div className="chart-section-heading">
          <p className="chart-section-label">Canonical reading order</p>
          <h3 id="process-order-heading">Process nodes and relationships</h3>
        </div>
        <ol aria-label="Process reading order">
          {orderedNodes.map((node, nodeIndex) => (
            <li key={node.id}>
              <article className="process-node">
                <p className="process-step-count">
                  Node {nodeIndex + 1} of {orderedNodes.length}
                </p>
                <h4 id={nodeHeadingId(node.id)} tabIndex={-1}>
                  {node.label}
                </h4>
                <p className="process-node-description">{node.description}</p>
                <p className="process-provenance">
                  Node provenance: {STATUS_LABELS[node.status]}
                </p>
                <NodeConnections
                  lesson={lesson}
                  loopEdgeIds={structure.loopEdgeIds}
                  node={node}
                  nodeById={nodeById}
                />
              </article>
            </li>
          ))}
        </ol>
      </section>

      <ProcessExplorer
        lesson={lesson}
        loopEdgeIds={structure.loopEdgeIds}
        nodeById={nodeById}
        orderedNodes={orderedNodes}
      />
      <p className="analysis-review-note">
        Draft only. Teacher review comes next.
      </p>
    </figure>
  );
}
