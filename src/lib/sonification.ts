export const SONIFICATION_MIDI_RANGE = {
  max: 84,
  midpoint: 66,
  min: 48,
} as const;

export const SONIFICATION_TIMING = {
  attackMs: 10,
  gapMs: 80,
  gain: 0.06,
  releaseMs: 30,
  toneDurationMs: 250,
} as const;

export type SonificationBounds = {
  max: number;
  min: number;
};

export type SonificationPitch = {
  frequency: number;
  midi: number;
};

export type SonificationTimelinePoint = SonificationPitch & {
  durationMs: number;
  index: number;
  startMs: number;
};

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number.`);
  }
}

function validateBounds(bounds: SonificationBounds): void {
  assertFinite(bounds.min, "Minimum bound");
  assertFinite(bounds.max, "Maximum bound");
  if (bounds.min > bounds.max) {
    throw new RangeError("Sonification bounds must be ordered from minimum to maximum.");
  }
}

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function mapValueToPitch(
  value: number,
  bounds: SonificationBounds,
): SonificationPitch {
  assertFinite(value, "Chart value");
  validateBounds(bounds);

  if (bounds.min === bounds.max) {
    return {
      frequency: midiToFrequency(SONIFICATION_MIDI_RANGE.midpoint),
      midi: SONIFICATION_MIDI_RANGE.midpoint,
    };
  }

  const normalized = Math.min(
    1,
    Math.max(0, (value - bounds.min) / (bounds.max - bounds.min)),
  );
  const midi =
    SONIFICATION_MIDI_RANGE.min +
    normalized * (SONIFICATION_MIDI_RANGE.max - SONIFICATION_MIDI_RANGE.min);

  return { frequency: midiToFrequency(midi), midi };
}

export function mapSeriesToPitches(
  values: readonly number[],
): SonificationPitch[] {
  if (values.length === 0) {
    throw new RangeError("Sonification requires at least one chart value.");
  }
  values.forEach((value) => assertFinite(value, "Chart value"));
  const bounds = {
    max: Math.max(...values),
    min: Math.min(...values),
  };
  return values.map((value) => mapValueToPitch(value, bounds));
}

export function buildSonificationTimeline(
  values: readonly number[],
): SonificationTimelinePoint[] {
  const pitches = mapSeriesToPitches(values);
  const stepMs = SONIFICATION_TIMING.toneDurationMs + SONIFICATION_TIMING.gapMs;

  return pitches.map((pitch, index) => ({
    ...pitch,
    durationMs: SONIFICATION_TIMING.toneDurationMs,
    index,
    startMs: index * stepMs,
  }));
}
