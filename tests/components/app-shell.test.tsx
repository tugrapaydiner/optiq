import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AccessibilityPageShell,
  AppShell,
  ExamplesPageShell,
  HowItWorksPageShell,
  LessonStudioPage,
  ProductPageShell,
  SiteFooter,
  SiteHeader,
} from "../../src/components/app-shell";
import { setRouteTransitionDirection } from "../../src/components/transition-link";

describe("site navigation", () => {
  it("uses a real route for every primary destination", () => {
    render(<SiteHeader />);

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    const primaryDestinations = within(primaryNavigation)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(primaryDestinations).toEqual([
      "/product",
      "/how-it-works",
      "/accessibility",
      "/examples",
    ]);
    expect(primaryDestinations.every((href) => !href?.includes("#"))).toBe(true);
    expect(
      screen.getAllByRole("link", { name: "Create a lesson" })[0],
    ).toHaveAttribute("href", "/create");
  });

  it("uses the supplied logo and owner credit in the footer", () => {
    render(<SiteFooter />);

    expect(screen.getByText("Optiq · Tugrap Turker Aydiner")).toBeInTheDocument();
    expect(document.querySelector(".brand-logo-light")).toBeInTheDocument();
  });

  it("sets forward and backward horizontal navigation intent", () => {
    setRouteTransitionDirection("/", "/product");
    expect(document.documentElement.dataset.routeDirection).toBe("forward");

    setRouteTransitionDirection("/examples", "/how-it-works");
    expect(document.documentElement.dataset.routeDirection).toBe("backward");
  });
});

describe("AppShell", () => {
  it("keeps the homepage focused and links to every main page", () => {
    render(<AppShell />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Visual lessons, made accessible.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Visual type" })).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);

    const directory = screen.getByRole("navigation", { name: "Explore Optiq" });
    expect(within(directory).getAllByRole("link")).toHaveLength(4);
  });
});

describe("dedicated information pages", () => {
  it("renders distinct product, workflow, and accessibility destinations", () => {
    const { rerender } = render(<ProductPageShell />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Keep the visual. Change the access.",
      }),
    ).toBeInTheDocument();

    rerender(<HowItWorksPageShell />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Four deliberate stages. One accountable path.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);

    rerender(<AccessibilityPageShell />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Access starts in the structure.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Three commitments.")).toBeInTheDocument();
  });
});

describe("LessonStudioPage", () => {
  it("uses the rebuilt editorial source controls and live upload state", () => {
    render(<LessonStudioPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Create a lesson." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Visual type" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Chart/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^Process diagram/ })).not.toBeChecked();
    expect(screen.getByLabelText("Image file")).toBeEnabled();
    expect(screen.getByLabelText("Image file")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "Choose a file" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Analyze source" })).toBeDisabled();
    expect(
      screen.getByText("Add a valid image to continue."),
    ).toBeInTheDocument();
  });

  it("communicates progress and the teacher-review boundary", () => {
    render(<LessonStudioPage />);

    expect(
      screen.getByRole("list", { name: "Lesson creation progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Teacher review is required before export."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/opaque functional session cookie/i),
    ).toBeInTheDocument();
  });
});

describe("ExamplesPageShell", () => {
  it("shows the two supported lesson formats without reusing photography", () => {
    render(<ExamplesPageShell />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "See the visual. Explore the structure.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(
      screen.getByRole("list", { name: "Chart lesson outputs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Process lesson outputs" }),
    ).toBeInTheDocument();
  });
});
