import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  RateLimitError,
} from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseUsage,
} from "openai/resources/responses/responses";

import { AnalysisFailure } from "../analyze/errors";
import type {
  AnalysisProvider,
  ProviderExtractionInput,
  ProviderExtractionResult,
} from "../analyze/provider";
import { chartResponseFormat, processResponseFormat } from "./schemas";
import { extractionPrompt } from "./prompts";

type OpenAIResponseLike = {
  error?: unknown | null;
  id: string;
  output_text: string;
  status?: string;
  usage?: ResponseUsage | null;
};

export type OpenAIResponsesClient = {
  create(
    body: ResponseCreateParamsNonStreaming,
    options?: { signal?: AbortSignal },
  ): Promise<OpenAIResponseLike>;
};

export function buildOpenAIRequest(
  input: Omit<ProviderExtractionInput, "signal">,
): ResponseCreateParamsNonStreaming {
  const responseFormat =
    input.mode === "chart" ? chartResponseFormat : processResponseFormat;
  const dataUrl = `data:${input.image.mimeType};base64,${input.image.bytes.toString("base64")}`;

  return {
    input: [
      {
        content: [
          { text: extractionPrompt(input.mode), type: "input_text" },
          {
            detail: "high",
            image_url: dataUrl,
            type: "input_image",
          },
        ],
        role: "user",
        type: "message",
      },
    ],
    max_output_tokens: 12_000,
    model: "gpt-5.6",
    reasoning: { effort: "medium" },
    safety_identifier: input.safetyIdentifier,
    store: false,
    text: { format: responseFormat },
  };
}

function mapProviderError(error: unknown): AnalysisFailure {
  if (
    error instanceof APIConnectionTimeoutError ||
    error instanceof APIUserAbortError ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return new AnalysisFailure("PROVIDER_TIMEOUT");
  }
  if (error instanceof RateLimitError) {
    return new AnalysisFailure("PROVIDER_RATE_LIMITED");
  }
  if (
    error instanceof APIConnectionError ||
    (error instanceof APIError && typeof error.status === "number" && error.status >= 500)
  ) {
    return new AnalysisFailure("PROVIDER_UNAVAILABLE");
  }
  if (error instanceof AnalysisFailure) return error;
  return new AnalysisFailure("PROVIDER_UNAVAILABLE");
}

export function createOpenAIProvider(client: OpenAIResponsesClient): AnalysisProvider {
  return {
    kind: "openai",
    async extract(input): Promise<ProviderExtractionResult> {
      let response: OpenAIResponseLike;
      try {
        response = await client.create(buildOpenAIRequest(input), {
          signal: input.signal,
        });
      } catch (error) {
        throw mapProviderError(error);
      }

      if (
        response.status !== "completed" ||
        response.error !== null ||
        response.output_text.trim().length === 0
      ) {
        throw new AnalysisFailure("INVALID_MODEL_OUTPUT");
      }

      const usage = response.usage
        ? {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
            total: response.usage.total_tokens,
          }
        : undefined;
      return {
        outputText: response.output_text,
        providerRequestId: response.id,
        tokenUsage: usage,
      };
    },
  };
}
