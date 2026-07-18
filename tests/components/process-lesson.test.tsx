import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProcessLessonView } from "@/components/process-lesson";
import type { ProcessLesson } from "@/lib/contracts/process";
import { validateProcessLesson } from "@/lib/contracts/semantic-validation";
import {
  makeProcessLesson,
  makeUnsupportedProcessLesson,
} from "../contracts/test-lessons";
import branchFixture from "../../fixtures/gold/process-01.json";
import cycleFixture from "../../fixtures/gold/process-02.json";

function renderLesson(lesson: ProcessLesson = makeProcessLesson()) {
  return render(
    <ProcessLessonView lesson={lesson} sourceLabel="Built-in sample draft" />,
  );
}

function nodeArticle(label: string): HTMLElement {
  const article = screen.getByRole("heading", { level: 4, name: label }).closest(
    "article",
  );
  expect(article).not.toBeNull();
  return article!;
}

describe("ProcessLessonView", () => {
  it("renders a complete figure and every linear node exactly once in reading order", () => {
    const { container } = renderLesson();

    expect(container.querySelector("figure")).not.toBeNull();
    expect(container.querySelector("figcaption")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Simple process" })).toBeVisible();
    expect(screen.getByText("The start leads to the finish.")).toBeVisible();
    expect(screen.getByText("Directed process")).toBeVisible();

    const order = screen.getByRole("list", { name: "Process reading order" });
    const directItems = Array.from(order.children);
    expect(directItems).toHaveLength(2);
    expect(
      directItems.map((item) => item.querySelector("h4")?.textContent),
    ).toEqual(["Start", "Finish"]);
    expect(container.querySelectorAll("#process-node-start")).toHaveLength(1);
    expect(container.querySelectorAll("#process-node-finish")).toHaveLength(1);

    const start = nodeArticle("Start");
    expect(within(start).getByText("The process begins.")).toBeVisible();
    expect(
      within(start).getByText("Node provenance: Verified visible text"),
    ).toBeVisible();
    expect(
      within(start).getByRole("link", { name: "Leads to: Finish" }),
    ).toHaveAttribute("href", "#process-node-finish");
    expect(
      within(start).getByText("Connection provenance: Inferred from layout"),
    ).toBeVisible();

    const finish = nodeArticle("Finish");
    expect(
      within(finish).getByRole("link", { name: "Arrives from: Start" }),
    ).toBeVisible();
    expect(
      within(finish).getByText(
        "None. This is an end point in the directed process.",
      ),
    ).toBeVisible();
  });

  it("lists every branch and convergence without pretending there is one next step", () => {
    renderLesson(branchFixture as ProcessLesson);

    expect(screen.getByText("Branching process")).toBeVisible();
    expect(
      screen.getByText(/does not imply that there is only one next step/i),
    ).toBeVisible();
    const order = screen.getByRole("list", { name: "Process reading order" });
    expect(
      Array.from(order.children).map(
        (item) => item.querySelector("h4")?.textContent,
      ),
    ).toEqual([
      "Seed",
      "Absorbs water",
      "Root emerges",
      "Shoot emerges",
      "First leaves open",
    ]);

    const water = nodeArticle("Absorbs water");
    expect(
      within(water).getByRole("link", { name: "Branch option: Root emerges" }),
    ).toBeVisible();
    expect(
      within(water).getByRole("link", { name: "Branch option: Shoot emerges" }),
    ).toBeVisible();

    const leaves = nodeArticle("First leaves open");
    expect(
      within(leaves).getByRole("link", { name: "Converges from: Root emerges" }),
    ).toBeVisible();
    expect(
      within(leaves).getByRole("link", { name: "Converges from: Shoot emerges" }),
    ).toBeVisible();
  });

  it("describes a cycle as continuing and exposes the return connection", () => {
    renderLesson(cycleFixture as ProcessLesson);

    expect(screen.getByText("Cycle")).toBeVisible();
    expect(
      screen.getByText(/last listed node is not an ending/i),
    ).toBeVisible();
    const collection = nodeArticle("Collection");
    expect(
      within(collection).getByRole("link", {
        name: "Loops back to: Evaporation",
      }),
    ).toBeVisible();
    const evaporation = nodeArticle("Evaporation");
    expect(
      within(evaporation).getByRole("link", {
        name: "Loop arrives from: Collection",
      }),
    ).toBeVisible();
    expect(
      within(evaporation).getByRole("link", {
        name: "Leads to: Condensation",
      }),
    ).toBeVisible();
    expect(
      within(evaporation).queryByRole("link", {
        name: "Loops back to: Condensation",
      }),
    ).toBeNull();
  });

  it("does not call a non-topological narration edge a loop", () => {
    const lesson = makeProcessLesson();
    lesson.nodes.splice(1, 0, {
      description: "This node is narrated before it is reached.",
      id: "middle",
      label: "Middle",
      status: "verified_visible_text",
    });
    lesson.edges[0]!.from = "finish";
    lesson.edges[0]!.to = "middle";
    lesson.edges.unshift({
      from: "start",
      id: "edge-start-finish",
      label: null,
      status: "inferred_from_layout",
      to: "finish",
    });
    lesson.readingOrder = ["start", "middle", "finish"];

    renderLesson(lesson);

    const finish = nodeArticle("Finish");
    expect(
      within(finish).getByRole("link", { name: "Leads to: Middle" }),
    ).toBeVisible();
    expect(
      within(finish).queryByRole("link", { name: "Loops back to: Middle" }),
    ).toBeNull();
  });

  it("uses non-wrapping native explorer controls with one explicit announcement", async () => {
    const user = userEvent.setup();
    renderLesson();
    const explorer = screen
      .getByRole("heading", { name: "Explore one node at a time" })
      .closest("section");
    expect(explorer).not.toBeNull();
    const previous = within(explorer!).getByRole("button", {
      name: "Previous node",
    });
    const next = within(explorer!).getByRole("button", { name: "Next node" });

    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(within(explorer!).getByText("Node 1 of 2")).toBeVisible();
    expect(within(explorer!).getByText("Start")).toBeVisible();
    expect(screen.getByTestId("process-announcement")).toBeEmptyDOMElement();

    await user.click(next);
    expect(within(explorer!).getByText("Node 2 of 2")).toBeVisible();
    expect(within(explorer!).getByText("Finish")).toBeVisible();
    expect(previous).toBeEnabled();
    expect(next).toBeDisabled();
    expect(screen.getByTestId("process-announcement")).toHaveTextContent(
      "Finish, node 2 of 2",
    );
    await user.click(next);
    expect(within(explorer!).getByText("Node 2 of 2")).toBeVisible();
  });

  it("moves focus only when a relationship link is explicitly activated", async () => {
    const user = userEvent.setup();
    renderLesson();
    const target = screen.getByRole("heading", { level: 4, name: "Finish" });
    const link = within(nodeArticle("Start")).getByRole("link", {
      name: "Leads to: Finish",
    });
    expect(target).not.toHaveFocus();

    link.focus();
    await user.keyboard("{Enter}");
    expect(target).toHaveFocus();
    expect(target).toHaveAttribute("id", "process-node-finish");
  });

  it("renders hostile node and edge strings as inert text", () => {
    const lesson = makeProcessLesson();
    lesson.nodes[0]!.label = '<script>alert("node")</script>';
    lesson.nodes[0]!.description = '<img src="x" onerror="alert(1)">';
    lesson.edges[0]!.label = '<button onclick="alert(1)">continue</button>';
    const { container } = renderLesson(lesson);

    expect(screen.getAllByText('<script>alert("node")</script>')).toHaveLength(2);
    expect(
      screen.getAllByText('<img src="x" onerror="alert(1)">'),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(/<button onclick="alert\(1\)">continue<\/button>/),
    ).toHaveLength(3);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(2);
  });

  it("renders no lesson for unsupported data and respects semantic blocking", () => {
    const unsupported = renderLesson(makeUnsupportedProcessLesson());
    expect(unsupported.container).toBeEmptyDOMElement();
    unsupported.unmount();

    const invalid = makeProcessLesson();
    invalid.edges[0]!.to = "missing-node";
    const validation = validateProcessLesson(invalid);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map(({ code }) => code)).toContain(
      "process.edge_reference",
    );
    const blocked = render(
      validation.valid ? (
        <ProcessLessonView lesson={invalid} sourceLabel="Invalid draft" />
      ) : null,
    );
    expect(blocked.container).toBeEmptyDOMElement();
  });
});
