import { render, screen } from "@testing-library/react";
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
      screen.getByText("Analysis is unavailable in this static preview."),
    ).toBeInTheDocument();
  });

  it("communicates the real workflow and teacher-review boundary", () => {
    render(<AppShell />);

    expect(
      screen.getByRole("list", { name: "Lesson creation progress" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Teacher review is required.")).toBeInTheDocument();
    expect(
      screen.getByText(/Critical uncertainties must be resolved/),
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

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^#/);
    }
  });
});
