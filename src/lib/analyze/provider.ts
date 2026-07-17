import type { AnalyzeMode, AnalysisProviderKind } from "./types";
import type { ValidatedImage } from "../upload/validate-image";

export type ProviderExtractionInput = {
  image: ValidatedImage;
  mode: AnalyzeMode;
  safetyIdentifier: string;
  signal: AbortSignal;
};

export type ProviderExtractionResult = {
  outputText: string;
  providerRequestId?: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
};

export interface AnalysisProvider {
  readonly kind: AnalysisProviderKind;
  extract(input: ProviderExtractionInput): Promise<ProviderExtractionResult>;
}
