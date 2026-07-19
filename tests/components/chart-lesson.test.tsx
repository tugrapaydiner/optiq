import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChartLessonView } from "@/components/chart-lesson";
import type {
  AudioPlaybackCallbacks,
  AudioPlayer,
} from "@/lib/audio-player";
import type { ChartLesson } from "@/lib/contracts/chart";
import type { SonificationTimelinePoint } from "@/lib/sonification";
import { makeChartLesson, makeUnsupportedChartLesson } from "../contracts/test-lessons";
import multiSeriesFixture from "../../fixtures/gold/chart-bar-02.json";

class FakeAudioPlayer implements AudioPlayer {
  callbacks: AudioPlaybackCallbacks | null = null;
  disposeCount = 0;
  readonly playCalls: SonificationTimelinePoint[][] = [];
  stopCount = 0;

  dispose(): void {
    this.disposeCount += 1;
  }

  emitComplete(): void {
    this.callbacks?.onComplete();
  }

  emitPoint(pointIndex: number): void {
    this.callbacks?.onPoint(pointIndex);
  }

  play(
    timeline: readonly SonificationTimelinePoint[],
    callbacks: AudioPlaybackCallbacks,
  ): Promise<void> {
    this.playCalls.push([...timeline]);
    this.callbacks = callbacks;
    return Promise.resolve();
  }

  stop(): void {
    this.stopCount += 1;
    this.callbacks = null;
  }
}

function renderLesson(lesson: ChartLesson = makeChartLesson()) {
  return render(
    <ChartLessonView lesson={lesson} sourceLabel="Built-in sample draft" />,
  );
}

function practicalLesson(seriesCount: number, pointsPerSeries: number): ChartLesson {
  const lesson = makeChartLesson();
  return {
    ...lesson,
    series: Array.from({ length: seriesCount }, (_seriesValue, seriesIndex) => ({
      id: `series-${seriesIndex + 1}`,
      label: `Series ${seriesIndex + 1}`,
      points: Array.from({ length: pointsPerSeries }, (_pointValue, pointIndex) => ({
        id: `series-${seriesIndex + 1}-point-${pointIndex + 1}`,
        xLabel: `Label ${pointIndex + 1}`,
        value: seriesIndex * 100 + pointIndex,
        displayValue: String(seriesIndex * 100 + pointIndex),
        status: "verified_visible_text" as const,
      })),
    })),
    trends: [],
  };
}

describe("ChartLessonView", () => {
  it("renders a complete figure and authoritative native table for one series", () => {
    const { container } = renderLesson();

    expect(container.querySelector("figure")).not.toBeNull();
    expect(container.querySelector("figcaption")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Monthly library visits" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Visits increase overall.")).toBeInTheDocument();
    expect(screen.getByText("X-axis").nextElementSibling).toHaveTextContent("Month");
    expect(screen.getByText("Y-axis").nextElementSibling).toHaveTextContent(
      "Visits (visits)",
    );

    const table = screen.getByRole("table", {
      name: "Monthly library visits — exact values",
    });
    expect(table.querySelector("caption")).toBeVisible();
    expect(table.querySelectorAll('thead th[scope="col"]')).toHaveLength(2);
    expect(table.querySelectorAll('tbody th[scope="row"]')).toHaveLength(2);
    const january = screen.getByRole("rowheader", { name: "Jan" }).closest("tr");
    expect(january).not.toBeNull();
    expect(within(january!).getByRole("cell")).toHaveTextContent("120 visits");
  });

  it("keeps multi-series column and row headers unambiguous with exact units", () => {
    renderLesson(multiSeriesFixture as ChartLesson);

    expect(screen.getByRole("columnheader", { name: "Light condition" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Bean (cm)" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Pea (cm)" })).toBeVisible();
    const lowRow = screen.getByRole("rowheader", { name: "Low" }).closest("tr");
    expect(lowRow).not.toBeNull();
    expect(within(lowRow!).getAllByRole("cell")[0]).toHaveTextContent("8 cm");
    expect(within(lowRow!).getAllByRole("cell")[1]).toHaveTextContent("6 cm");
  });

  it("renders HTML-looking lesson text inertly", () => {
    const lesson = makeChartLesson();
    lesson.title = '<script>alert("title")</script>';
    lesson.summary = '<img src="x" onerror="alert(1)">';
    lesson.series[0]!.label = "<button>not a control</button>";
    lesson.series[0]!.points[0]!.xLabel = "<svg onload=alert(1)>";

    const { container } = renderLesson(lesson);

    expect(screen.getByText('<script>alert("title")</script>')).toBeVisible();
    expect(screen.getByText('<img src="x" onerror="alert(1)">')).toBeVisible();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(4);
  });

  it("uses predictable non-wrapping buttons and one explicit live update", async () => {
    const user = userEvent.setup();
    renderLesson();

    const previous = screen.getByRole("button", { name: "Previous point" });
    const next = screen.getByRole("button", { name: "Next point" });
    const announcement = screen.getByTestId("point-announcement");
    const readout = screen
      .getByText(/Visits — Jan — 120 visits/)
      .closest<HTMLElement>(".point-readout");
    expect(readout).not.toBeNull();
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(announcement).toBeEmptyDOMElement();

    await user.click(next);
    expect(within(readout!).getByText(/Visits — Feb — 165 visits — point 2 of 2/)).toBeVisible();
    expect(next).toBeDisabled();
    expect(previous).toBeEnabled();
    expect(announcement).toHaveTextContent(
      "Visits — Feb — 165 visits — point 2 of 2",
    );
    expect(screen.getAllByTestId("point-announcement")).toHaveLength(1);

    await user.click(previous);
    expect(within(readout!).getByText(/Visits — Jan — 120 visits — point 1 of 2/)).toBeVisible();
    expect(previous).toBeDisabled();
  });

  it("scopes Arrow keys to the focused point readout", async () => {
    const user = userEvent.setup();
    renderLesson();
    const readout = screen
      .getByText(/Visits — Jan — 120 visits — point 1 of 2/)
      .closest<HTMLElement>(".point-readout");
    expect(readout).not.toBeNull();

    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(within(readout!).getByText(/point 1 of 2/)).toBeVisible();

    readout!.focus();
    await user.keyboard("{ArrowRight}");
    expect(within(readout!).getByText(/point 2 of 2/)).toBeVisible();
    expect(readout).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(within(readout!).getByText(/point 2 of 2/)).toBeVisible();
  });

  it("resets to the first point when the series changes", async () => {
    const user = userEvent.setup();
    renderLesson(multiSeriesFixture as ChartLesson);
    const readout = screen
      .getByText(/Bean — Low — 8 cm/)
      .closest<HTMLElement>(".point-readout");
    expect(readout).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Next point" }));
    expect(within(readout!).getByText(/Bean — Medium — 14 cm — point 2 of 4/)).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "Series" }), "1");
    expect(within(readout!).getByText(/Pea — Low — 6 cm — point 1 of 4/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous point" })).toBeDisabled();
    expect(screen.getByTestId("point-announcement")).toHaveTextContent(
      "Pea — Low — 6 cm — point 1 of 4",
    );
    expect(screen.getByTestId("audio-announcement")).toBeEmptyDOMElement();
  });

  it("creates audio only on keyboard Play and keeps timed updates out of live regions", async () => {
    const user = userEvent.setup();
    const player = new FakeAudioPlayer();
    const factory = vi.fn(() => player);
    render(
      <ChartLessonView
        audioPlayerFactory={factory}
        lesson={makeChartLesson()}
        sourceLabel="Built-in sample draft"
      />,
    );

    const play = screen.getByRole("button", { name: "Play series" });
    const stop = screen.getByRole("button", { name: "Stop" });
    expect(factory).not.toHaveBeenCalled();
    expect(stop).toBeDisabled();

    play.focus();
    await user.keyboard("{Enter}");
    expect(factory).toHaveBeenCalledTimes(1);
    expect(player.stopCount).toBe(1);
    expect(player.playCalls).toHaveLength(1);
    expect(player.playCalls[0]!.map(({ midi }) => midi)).toEqual([48, 84]);
    expect(stop).toBeEnabled();
    expect(screen.getByTestId("sonification-status")).toHaveTextContent(
      "Playing Visits — point 1 of 2.",
    );
    expect(screen.getByTestId("audio-announcement")).toHaveTextContent(
      "Playback started for Visits.",
    );
    expect(screen.getByTestId("point-announcement")).toBeEmptyDOMElement();

    act(() => player.emitPoint(1));
    expect(screen.getByTestId("sonification-status")).toHaveTextContent(
      "Playing Visits — point 2 of 2.",
    );
    expect(screen.getByText(/Visits — Feb — 165 visits — point 2 of 2/)).toBeVisible();
    expect(screen.getByTestId("point-announcement")).toBeEmptyDOMElement();
    expect(screen.getByTestId("audio-announcement")).toHaveTextContent(
      "Playback started for Visits.",
    );

    stop.focus();
    await user.keyboard("{Enter}");
    expect(player.stopCount).toBe(2);
    expect(stop).toBeDisabled();
    expect(screen.getByTestId("sonification-status")).toHaveTextContent(
      "Playback stopped.",
    );
    expect(screen.getByTestId("audio-announcement")).toHaveTextContent(
      "Playback stopped.",
    );
    expect(play).toHaveFocus();
  });

  it("restarts without overlap, completes quietly, and stops on series change", async () => {
    const user = userEvent.setup();
    const player = new FakeAudioPlayer();
    render(
      <ChartLessonView
        audioPlayerFactory={() => player}
        lesson={multiSeriesFixture as ChartLesson}
        sourceLabel="Built-in sample draft"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Play series" }));
    await user.click(screen.getByRole("button", { name: "Restart series" }));
    expect(player.stopCount).toBe(2);
    expect(player.playCalls).toHaveLength(2);
    expect(screen.getByTestId("audio-announcement")).toHaveTextContent(
      "Playback restarted for Bean.",
    );

    act(() => player.emitComplete());
    expect(screen.getByTestId("sonification-status")).toHaveTextContent(
      "Playback complete for Bean.",
    );
    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();

    await user.selectOptions(screen.getByRole("combobox", { name: "Series" }), "1");
    expect(screen.getByTestId("sonification-status")).toHaveTextContent(
      "Ready to play Pea.",
    );
    expect(screen.getByTestId("audio-announcement")).toBeEmptyDOMElement();
    await user.selectOptions(screen.getByRole("combobox", { name: "Series" }), "0");

    await user.click(screen.getByRole("button", { name: "Play series" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Series" }), "1");
    expect(player.stopCount).toBe(6);
    expect(screen.getByTestId("sonification-status")).toHaveTextContent(
      "Ready to play Pea.",
    );
    expect(screen.getByTestId("point-announcement")).toHaveTextContent(
      "Pea — Low — 6 cm — point 1 of 4",
    );
  });

  it("disposes active audio when the lesson changes or the component unmounts", async () => {
    const user = userEvent.setup();
    const firstPlayer = new FakeAudioPlayer();
    const secondPlayer = new FakeAudioPlayer();
    const factory = vi
      .fn<() => AudioPlayer>()
      .mockReturnValueOnce(firstPlayer)
      .mockReturnValueOnce(secondPlayer);
    const firstLesson = makeChartLesson();
    const secondLesson = makeChartLesson();
    secondLesson.series[0]!.points[0]!.value = 999;

    const { rerender, unmount } = render(
      <ChartLessonView
        audioPlayerFactory={factory}
        lesson={firstLesson}
        sourceLabel="Built-in sample draft"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Play series" }));

    rerender(
      <ChartLessonView
        audioPlayerFactory={factory}
        lesson={secondLesson}
        sourceLabel="Built-in sample draft"
      />,
    );
    expect(firstPlayer.disposeCount).toBe(1);
    expect(screen.getByTestId("sonification-status")).toHaveTextContent(
      "Ready to play Visits.",
    );

    await user.click(screen.getByRole("button", { name: "Play series" }));
    unmount();
    expect(secondPlayer.disposeCount).toBe(1);
  });

  it("renders no lesson output for an unsupported lesson", () => {
    const { container } = renderLesson(makeUnsupportedChartLesson());
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("preserves semantics at the contract's practical maxima", () => {
    const { rerender } = renderLesson(practicalLesson(6, 20));
    let table = screen.getByRole("table");
    expect(table.querySelectorAll('thead th[scope="col"]')).toHaveLength(7);
    expect(table.querySelectorAll('tbody th[scope="row"]')).toHaveLength(20);
    expect(within(table).getByText("519 visits")).toBeVisible();

    rerender(
      <ChartLessonView
        lesson={practicalLesson(1, 50)}
        sourceLabel="Built-in sample draft"
      />,
    );
    table = screen.getByRole("table");
    expect(table.querySelectorAll('thead th[scope="col"]')).toHaveLength(2);
    expect(table.querySelectorAll('tbody th[scope="row"]')).toHaveLength(50);
    expect(within(table).getByText("49 visits")).toBeVisible();
  });
});
