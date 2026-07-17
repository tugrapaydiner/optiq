import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "../../src/components/app-shell";

describe("AppShell", () => {
  it("renders one meaningful heading and named mode controls", () => {
    render(<AppShell />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName(
      "Visual lessons, made accessible.",
    );

    expect(
      screen.getByRole("group", { name: "Visual type" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Chart/ })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /^Process diagram/ }),
    ).not.toBeChecked();
  });

  it("keeps upload actions truthfully unavailable in the static preview", () => {
    render(<AppShell />);

    expect(screen.getByLabelText("Image file")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Analyze source" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Preview only — analysis is not connected yet."),
    ).toBeInTheDocument();
  });

  it("communicates the real workflow and teacher-review boundary", () => {
    render(<AppShell />);

    expect(
      screen.getByRole("list", { name: "Lesson creation progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review required before export."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Resolve uncertain details first/),
    ).toBeInTheDocument();
  });

  it("uses the supplied imagery and only in-page navigation destinations", () => {
    render(<AppShell />);

    expect(
      screen.getByRole("img", {
        name: /Two learners work with laptops, headphones/,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(4);
    expect(document.querySelector(".brand-logo")).toBeInTheDocument();

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^#/);
    }

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    const primaryDestinations = within(primaryNavigation)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(new Set(primaryDestinations).size).toBe(primaryDestinations.length);
    for (const destination of primaryDestinations) {
      expect(
        document.querySelector(destination ?? "missing"),
      ).toBeInTheDocument();
    }

    const mobileNavigation = screen.getByRole("navigation", {
      name: "Mobile navigation",
    });
    const mobileDestinations = within(mobileNavigation)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(new Set(mobileDestinations).size).toBe(mobileDestinations.length);
  });
});
