import processBranch from "../../../fixtures/gold/process-01.json";
import processCycle from "../../../fixtures/gold/process-02.json";

import type { ProcessLesson } from "../contracts/process";

export type ProcessSample = {
  description: string;
  id: string;
  label: string;
  lesson: ProcessLesson;
};

export const PROCESS_SAMPLES: readonly ProcessSample[] = [
  {
    description: "A branch that reconnects",
    id: "process-01",
    label: "Seed germination",
    lesson: processBranch as ProcessLesson,
  },
  {
    description: "A four-step repeating cycle",
    id: "process-02",
    label: "Water cycle",
    lesson: processCycle as ProcessLesson,
  },
] as const;

export function getProcessSample(sampleId: string): ProcessSample {
  return (
    PROCESS_SAMPLES.find(({ id }) => id === sampleId) ?? PROCESS_SAMPLES[0]!
  );
}
