import "server-only";

import { AnalysisFailure } from "../analyze/errors";
import type { AnalysisProvider } from "../analyze/provider";
import { getOpenAIClient } from "../openai/client";
import { createOpenAIProvider } from "../openai/provider";
import { createFixtureProvider } from "./fixture-provider";

export function getConfiguredProvider(): AnalysisProvider {
  const configured = process.env.OPTIQ_PROVIDER ?? "openai";

  if (configured === "fixture") {
    if (process.env.NODE_ENV === "production") {
      throw new AnalysisFailure("PROVIDER_UNAVAILABLE", false);
    }
    return createFixtureProvider();
  }

  if (configured !== "openai") {
    throw new AnalysisFailure("PROVIDER_UNAVAILABLE", false);
  }

  return createOpenAIProvider(getOpenAIClient().responses);
}
