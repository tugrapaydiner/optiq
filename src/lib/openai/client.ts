import "server-only";

import OpenAI from "openai";

import { AnalysisFailure } from "../analyze/errors";
import { PROVIDER_TIMEOUT_MS } from "../upload/config";

let client: OpenAI | undefined;

export function getOpenAIClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AnalysisFailure("PROVIDER_UNAVAILABLE", false);
  }

  client = new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: PROVIDER_TIMEOUT_MS,
  });
  return client;
}
