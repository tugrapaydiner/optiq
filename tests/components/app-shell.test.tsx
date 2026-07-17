import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AppShell,
  ExamplesPageShell,
  LessonStudioPage,
} from "../../src/components/app-shell";

describe("AppShell", () => {
  it("keeps the homepage focused on the product story", () => {
    render(<AppShell />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Visual lessons, made accessible.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Visual type" })).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(document.querySelectorAll(".brand-logo")).toHaveLength(2);
  });

  it("uses distinct primary routes and anchors", () => {
    render(<AppShell />);

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    const primaryLinks = within(primaryNavigation).getAllByRole("link");
    const primaryDestinations = primaryLinks.map((link) =>
      link.getAttribute("href"),
    );

    expect(primaryDestinations).toEqual([
      "/#product",
      "/#how-it-works",
      "/#accessibility",
      "/examples",
    ]);
    expect(new Set(primaryDestinations).size).toBe(primaryDestinations.length);
    expect(screen.getAllByRole("link", { name: "Create a lesson" })[0]).toHaveAttribute(
      "href",
      "/create",
    );
  });

  it("credits the owner and uses the supplied logo in the footer", () => {
    render(<AppShell />);

    expect(screen.getByText("Optiq · Tugrap Turker Aydiner")).toBeInTheDocument();
    expect(document.querySelector(".brand-logo-light")).toBeInTheDocument();
    expect(
      screen.queryByText("AI-assisted accessibility, reviewed by educators."),
    ).toBeNull();
  });
});

describe("LessonStudioPage", () => {
  it("keeps the native source controls and truthful preview state", () => {
    render(<LessonStudioPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Start with one visual." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Visual type" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Chart/ })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /^Process diagram/ }),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Image file")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Analyze source" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Analysis is not connected in this preview."),
    ).toBeInTheDocument();
  });

  it("communicates progress and the review boundary", () => {
    render(<LessonStudioPage />);

    expect(
      screen.getByRole("list", { name: "Lesson creation progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review required before export."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Resolve uncertain details first/)).toBeInTheDocument();
  });
});

describe("ExamplesPageShell", () => {
  it("uses large narrative examples without small image labels", () => {
    render(<ExamplesPageShell />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "See the visual. Explore the structure.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Every value becomes explorable.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Educators keep the final say.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Relationships stay connected.",
      }),
    ).toBeInTheDocument();
    expect(document.querySelector(".story-label")).toBeNull();
  });
});
