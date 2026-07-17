import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyzeEnvelope } from "@/lib/analyze/types";
import { LessonCreator } from "@/components/lesson-creator";
import { makeChartLesson } from "../contracts/test-lessons";

function jsonResponse(body: AnalyzeEnvelope): Response {
  return { json: vi.fn(async () => body) } as unknown as Response;
}

function successEnvelope(
  title = "Monthly library visits",
): AnalyzeEnvelope {
  return {
    lesson: { ...makeChartLesson(), title },
    mode: "chart",
    ok: true,
    provider: "fixture",
    requestId: "request-1",
  };
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:optiq-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal("fetch", vi.fn());
});

describe("LessonCreator", () => {
  it("starts with native controls and enables analysis only for a valid file", async () => {
    const user = userEvent.setup();
    render(<LessonCreator maxUploadBytes={1024 * 1024} />);

    const input = screen.getByLabelText("Image file");
    const analyze = screen.getByRole("button", { name: "Analyze source" });
    expect(input).toBeEnabled();
    expect(screen.getByRole("button", { name: "Choose a file" })).toBeEnabled();
    expect(analyze).toBeDisabled();
    expect(input).toHaveAttribute("tabindex", "-1");

    await user.upload(
      input,
      new File([new Uint8Array([1, 2, 3])], "lesson.png", {
        type: "image/png",
      }),
    );

    expect(screen.getByAltText("Preview of the selected source image")).toBeVisible();
    expect(screen.getByText("lesson.png")).toBeInTheDocument();
    expect(analyze).toBeEnabled();
    expect(screen.getByRole("button", { name: "Replace" })).toBeEnabled();
    const remove = screen.getByRole("button", { name: "Remove" });
    expect(remove).toBeEnabled();
    await waitFor(() => expect(analyze).toHaveFocus());

    await user.click(remove);
    const choose = screen.getByRole("button", { name: "Choose a file" });
    await waitFor(() => expect(choose).toHaveFocus());
    expect(analyze).toBeDisabled();
  });

  it("submits mode and image, announces loading, and renders a reviewed draft summary", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch).mockResolvedValue(
      jsonResponse(successEnvelope()),
    );
    render(<LessonCreator />);

    await user.upload(
      screen.getByLabelText("Image file"),
      new File(["chart"], "chart.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Analyze source" }));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/analyze");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("mode")).toBe("chart");
    expect((init?.body as FormData).get("file")).toBeInstanceOf(File);

    expect(
      await screen.findByRole("heading", { name: "Monthly library visits" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Built-in fixture draft")).toBeInTheDocument();
    expect(screen.getByText("Draft only. Teacher review comes next.")).toBeInTheDocument();
  });

  it("keeps the selected image after a retryable error and succeeds on retry", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({
          error: {
            code: "PROVIDER_UNAVAILABLE",
            message: "Live analysis is temporarily unavailable. Try again shortly or explore a built-in sample.",
            retryable: true,
          },
          ok: false,
          requestId: "request-error",
        }),
      )
      .mockResolvedValueOnce(jsonResponse(successEnvelope("Retry succeeded")));
    render(<LessonCreator />);

    await user.upload(
      screen.getByLabelText("Image file"),
      new File(["chart"], "retry.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Analyze source" }));

    const errorHeading = await screen.findByRole("heading", {
      name: "Analysis error",
    });
    expect(errorHeading).toHaveFocus();
    expect(screen.getByText("retry.png")).toBeInTheDocument();
    expect(screen.getByText(/selected image is still here/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Retry succeeded" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts an older request and never lets its stale result replace the newer image", async () => {
    const user = userEvent.setup();
    const first = deferred<Response>();
    const second = deferred<Response>();
    let firstSignal: AbortSignal | null = null;
    const fetchMock = vi
      .mocked(fetch)
      .mockImplementationOnce((_url, init) => {
        firstSignal = init?.signal as AbortSignal;
        return first.promise;
      })
      .mockImplementationOnce(() => second.promise);
    render(<LessonCreator />);

    const input = screen.getByLabelText("Image file");
    await user.upload(
      input,
      new File(["first"], "first.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Analyze source" }));

    await user.upload(
      input,
      new File(["second"], "second.png", { type: "image/png" }),
    );
    expect((firstSignal as AbortSignal | null)?.aborted).toBe(true);
    await user.click(screen.getByRole("button", { name: "Analyze source" }));

    await act(async () => {
      second.resolve(jsonResponse(successEnvelope("Second image wins")));
    });
    expect(
      await screen.findByRole("heading", { name: "Second image wins" }),
    ).toBeInTheDocument();

    await act(async () => {
      first.resolve(jsonResponse(successEnvelope("Stale first image")));
    });
    expect(screen.queryByText("Stale first image")).not.toBeInTheDocument();
    expect(screen.getByText("Second image wins")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("supports keyboard mode selection and renders HTML-looking output as inert text", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(successEnvelope('<img src="x" onerror="alert(1)">')),
    );
    const { container } = render(<LessonCreator />);

    const chart = screen.getByRole("radio", { name: /^Chart/ });
    chart.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /^Process diagram/ })).toBeChecked();
    await user.keyboard("{ArrowUp}");
    expect(chart).toBeChecked();

    await user.upload(
      screen.getByLabelText("Image file"),
      new File(["chart"], "safe.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Analyze source" }));

    expect(
      await screen.findByText('<img src="x" onerror="alert(1)">'),
    ).toBeInTheDocument();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it("rejects a client-side invalid type and keeps the privacy boundary visible", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<LessonCreator maxUploadBytes={1024} />);

    await user.upload(
      screen.getByLabelText("Image file"),
      new File(["text"], "notes.txt", { type: "text/plain" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a PNG, JPEG, or WebP image.",
    );
    expect(screen.getByRole("button", { name: "Analyze source" })).toBeDisabled();
    expect(screen.getByText(/opaque functional session cookie/i)).toBeVisible();
    expect(screen.getByText(/OpenAI's current API data controls apply/i)).toBeVisible();
  });
});
