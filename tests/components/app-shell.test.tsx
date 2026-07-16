import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "../../src/components/app-shell";

describe("AppShell", () => {
  it("renders one meaningful heading and named mode controls", () => {
    render(<AppShell />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName(
      "Make visual lessons accessible.",
    );

    expect(
      screen.getByRole("group", { name: "Visual type" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Chart/ })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /^Process diagram/ }),
    ).not.toBeChecked();
  });

  it("keeps upload actions unavailable in the bootstrap shell", () => {
    render(<AppShell />);

    expect(screen.getByLabelText("Image file")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analyze image" })).toBeDisabled();
    expect(
      screen.getByText("No file is sent in this preview."),
    ).toBeInTheDocument();
  });

  it("communicates the real workflow and teacher-review boundary", () => {
    render(<AppShell />);

    expect(
      screen.getByRole("list", { name: "Lesson creation progress" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Teacher review required")).toBeInTheDocument();
    expect(
      screen.getByText(/Critical uncertainties must be resolved before/),
    ).toBeInTheDocument();
  });
});
