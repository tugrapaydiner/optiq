// @vitest-environment node

import { describe, expect, it } from "vitest";

import { validateProviderOutput } from "@/lib/analyze/validate-output";
import { createFixtureProvider } from "@/lib/providers/fixture-provider";

const safetyIdentifier = `anon_${"A".repeat(22)}`;

function fixtureInput(mode: "chart" | "process", signal: AbortSignal) {
  return {
    image: {
      bytes: Buffer.from([1]),
      height: 1,
      mimeType: "image/png" as const,
      width: 1,
    },
    mode,
    safetyIdentifier,
    signal,
  };
}

describe("fixture provider", () => {
  it.each(["chart", "process"] as const)(
    "returns deterministic locally valid %s output without a network call",
    async (mode) => {
      const provider = createFixtureProvider();
      const first = await provider.extract(
        fixtureInput(mode, new AbortController().signal),
      );
      const second = await provider.extract(
        fixtureInput(mode, new AbortController().signal),
      );

      expect(first.outputText).toBe(second.outputText);
      expect(first.providerRequestId).toBe(`fixture_${mode}`);
      expect(validateProviderOutput(mode, first.outputText)).toMatchObject({
        schemaVersion: "1.0",
        supported: true,
      });
    },
  );

  it("stops immediately when the request is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      createFixtureProvider().extract(fixtureInput("chart", controller.signal)),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
