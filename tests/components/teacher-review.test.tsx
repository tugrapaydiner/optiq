import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TeacherReviewPanel } from "@/components/teacher-review";
import type { ChartLesson } from "@/lib/contracts/chart";
import type { ProcessLesson } from "@/lib/contracts/process";
import {
  REVIEW_ACKNOWLEDGEMENT,
  createTeacherReviewState,
} from "@/lib/review/state";
import {
  makeChartLesson,
  makeProcessLesson,
} from "../contracts/test-lessons";

function chartLesson(): ChartLesson {
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

function ChartHarness({ lesson = chartLesson() }: { lesson?: ChartLesson }) {
  const [state, setState] = useState(() => createTeacherReviewState(lesson));
  return (
    <TeacherReviewPanel mode="chart" onChange={setState} state={state} />
  );
}

function ProcessHarness({ lesson }: { lesson: ProcessLesson }) {
  const [state, setState] = useState(() => createTeacherReviewState(lesson));
  return (
    <TeacherReviewPanel mode="process" onChange={setState} state={state} />
  );
}

function summaryValue(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" });
  const value = term.parentElement?.querySelector("dd");
  expect(value).not.toBeNull();
  return value!;
}

describe("TeacherReviewPanel", () => {
  it("requires correction, explicit resolution, stale-trend review, and acknowledgment", async () => {
    const user = userEvent.setup();
    render(<ChartHarness />);

    expect(
      screen.getByRole("heading", { name: "Review the extracted lesson" }),
    ).toBeVisible();
    expect(summaryValue("Unresolved critical")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Export lesson" })).toBeDisabled();
    expect(
      screen.getByText("Every critical review item must be resolved."),
    ).toBeVisible();
    expect(screen.getByLabelText(REVIEW_ACKNOWLEDGEMENT)).not.toBeChecked();

    const blocker = screen.getByRole("link", { name: "Go to the first blocker" });
    await user.click(blocker);
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "Visits — Jan — numeric value",
      }),
    ).toHaveFocus();

    const value = screen.getByRole("textbox", {
      name: "Visits — Jan — numeric value",
    });
    await user.clear(value);
    expect(value).toHaveAccessibleDescription("Enter a finite number.");
    const valueItem = screen
      .getByRole("heading", {
        level: 4,
        name: "Visits — Jan — numeric value",
      })
      .closest("article")!;
    await user.click(within(valueItem).getByRole("button", { name: "Mark resolved" }));
    expect(screen.getByTestId("review-announcement")).toHaveTextContent(
      "Enter a finite number.",
    );
    expect(summaryValue("Unresolved critical")).toHaveTextContent("1");

    await user.type(value, "125");
    expect(summaryValue("Unresolved critical")).toHaveTextContent("2");
    expect(screen.getByRole("heading", { level: 4, name: "Trend 1" })).toBeVisible();
    expect(within(valueItem).getByText("Original").parentElement).toHaveTextContent(
      "120",
    );

    await user.click(within(valueItem).getByRole("button", { name: "Mark resolved" }));
    const trendItem = screen
      .getByRole("heading", { level: 4, name: "Trend 1" })
      .closest("article")!;
    await user.click(within(trendItem).getByRole("button", { name: "Mark resolved" }));
    expect(summaryValue("Unresolved critical")).toHaveTextContent("0");
    expect(screen.getByText("Teacher acknowledgement is required.")).toBeVisible();

    await user.click(screen.getByLabelText(REVIEW_ACKNOWLEDGEMENT));
    expect(screen.getByRole("heading", { name: "Review complete" })).toBeVisible();
    expect(
      screen.getByText(/download one self-contained HTML lesson/i),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Export lesson" })).toBeEnabled();

    await user.clear(value);
    await user.type(value, "130");
    expect(screen.getByLabelText(REVIEW_ACKNOWLEDGEMENT)).not.toBeChecked();
    expect(summaryValue("Unresolved critical")).toHaveTextContent("2");
    expect(within(valueItem).getByRole("button", { name: "Mark resolved" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Export lesson" })).toBeDisabled();
  });

  it("uses controlled process endpoints and non-drag reading-order buttons", async () => {
    const user = userEvent.setup();
    const lesson = makeProcessLesson();
    lesson.edges[0]!.status = "unclear";
    lesson.reviewItems.push({
      id: "review-edge-target",
      message: "Confirm where this connection ends.",
      severity: "critical",
      status: "unclear",
      targetPath: "/edges/start-to-finish/to",
    });
    render(<ProcessHarness lesson={lesson} />);

    const target = screen.getByRole("combobox", { name: "Connected node" });
    expect(within(target).getAllByRole("option")).toHaveLength(2);
    expect(within(target).queryByRole("option", { name: "Missing" })).toBeNull();

    await user.click(
      screen.getByText("Review connections and reading order", {
        selector: "summary",
      }),
    );
    const order = screen.getByRole("heading", { name: "Reading order" }).parentElement!;
    await user.click(
      screen.getByText("Review other lesson fields", { selector: "summary" }),
    );
    const startLabel = screen.getByRole("textbox", {
      name: "Start — node label",
    });
    await user.clear(startLabel);
    await user.type(startLabel, "Begin");
    expect(within(order).getByText(/^Original:/)).toHaveTextContent(
      "Original: Start → Finish",
    );
    expect(within(order).getAllByRole("listitem")[0]).toHaveTextContent(
      "1. Begin",
    );
    const finishRow = within(order).getByText("2. Finish").closest("li")!;
    await user.click(within(finishRow).getByRole("button", { name: "Move up" }));
    expect(within(order).getAllByRole("listitem")[0]).toHaveTextContent("1. Finish");
    expect(screen.getByTestId("review-announcement")).toHaveTextContent(
      "Finish moved up.",
    );
    expect(within(order).getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders hostile teacher-edit text as inert content", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChartHarness />);
    const titleDisclosure = screen.getByText("Review other lesson fields", {
      selector: "summary",
    });
    await user.click(titleDisclosure);
    const title = screen.getByRole("textbox", { name: "Lesson title" });
    await user.clear(title);
    await user.type(title, '<img src="x" onerror="alert(1)">');

    expect(screen.getByDisplayValue('<img src="x" onerror="alert(1)">')).toBeVisible();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });
});
