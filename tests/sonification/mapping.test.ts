import { describe, expect, it } from "vitest";

import {
  SONIFICATION_TIMING,
  buildSonificationTimeline,
  mapSeriesToPitches,
  mapValueToPitch,
} from "@/lib/sonification";

describe("deterministic chart sonification mapping", () => {
  it("maps derived minimum, midpoint, and maximum to MIDI 48, 66, and 84", () => {
    const pitches = mapSeriesToPitches([0, 50, 100]);

    expect(pitches.map(({ midi }) => midi)).toEqual([48, 66, 84]);
    expect(pitches[0]!.frequency).toBeCloseTo(130.8128, 3);
    expect(pitches[1]!.frequency).toBeCloseTo(369.9944, 3);
    expect(pitches[2]!.frequency).toBeCloseTo(1046.5023, 3);
  });

  it("normalizes negative ranges without changing their relative shape", () => {
    expect(mapSeriesToPitches([-10, 0, 10]).map(({ midi }) => midi)).toEqual([
      48, 66, 84,
    ]);
  });

  it("maps equal-value and one-point series to midpoint MIDI 66", () => {
    expect(mapSeriesToPitches([7, 7]).map(({ midi }) => midi)).toEqual([66, 66]);
    expect(mapSeriesToPitches([42])[0]!.midi).toBe(66);
  });

  it("clamps only against explicit finite bounds", () => {
    expect(mapValueToPitch(-20, { max: 100, min: 0 }).midi).toBe(48);
    expect(mapValueToPitch(120, { max: 100, min: 0 }).midi).toBe(84);
    expect(mapValueToPitch(25, { max: 100, min: 0 }).midi).toBe(57);
  });

  it("rejects empty series, invalid bounds, NaN, and Infinity", () => {
    expect(() => mapSeriesToPitches([])).toThrow(/at least one/i);
    expect(() => mapSeriesToPitches([Number.NaN])).toThrow(/finite/i);
    expect(() => mapSeriesToPitches([Number.POSITIVE_INFINITY])).toThrow(/finite/i);
    expect(() => mapValueToPitch(1, { max: 0, min: 2 })).toThrow(/bounds/i);
    expect(() =>
      mapValueToPitch(1, { max: Number.POSITIVE_INFINITY, min: 0 }),
    ).toThrow(/finite/i);
  });

  it("builds an ordered 250 ms tone timeline with 80 ms gaps", () => {
    const timeline = buildSonificationTimeline([2, 4, 8]);

    expect(SONIFICATION_TIMING).toEqual({
      attackMs: 10,
      gapMs: 80,
      gain: 0.06,
      releaseMs: 30,
      toneDurationMs: 250,
    });
    expect(timeline).toHaveLength(3);
    expect(
      timeline.map(({ durationMs, index, startMs }) => ({
        durationMs,
        index,
        startMs,
      })),
    ).toEqual([
      { durationMs: 250, index: 0, startMs: 0 },
      { durationMs: 250, index: 1, startMs: 330 },
      { durationMs: 250, index: 2, startMs: 660 },
    ]);
    expect(timeline.map(({ midi }) => midi)).toEqual([48, 60, 84]);
  });
});
