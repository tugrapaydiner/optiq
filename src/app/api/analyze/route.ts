import { createAnalyzeHandler } from "@/lib/analyze/handler";
import { getConfiguredProvider } from "@/lib/providers/configured-provider";

export const runtime = "nodejs";

const analyze = createAnalyzeHandler({
  providerFactory: getConfiguredProvider,
});

export async function POST(request: Request): Promise<Response> {
  return analyze(request);
}
