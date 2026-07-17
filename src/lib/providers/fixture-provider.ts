import chartFixture from "../../../fixtures/gold/chart-bar-01.json";
import processFixture from "../../../fixtures/gold/process-02.json";

import type { AnalysisProvider } from "../analyze/provider";

export function createFixtureProvider(): AnalysisProvider {
  return {
    kind: "fixture",
    async extract(input) {
      if (input.signal.aborted) {
        throw new DOMException("The request was aborted.", "AbortError");
      }
      return {
        outputText: JSON.stringify(
          input.mode === "chart" ? chartFixture : processFixture,
        ),
        providerRequestId: `fixture_${input.mode}`,
      };
    },
  };
}
