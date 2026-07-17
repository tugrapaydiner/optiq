import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebAudioPlayer } from "@/lib/audio-player";
import { buildSonificationTimeline } from "@/lib/sonification";

class FakeAudioParam {
  readonly events: Array<{ method: string; time: number; value: number }> = [];

  linearRampToValueAtTime(value: number, time: number): AudioParam {
    this.events.push({ method: "ramp", time, value });
    return this as unknown as AudioParam;
  }

  setValueAtTime(value: number, time: number): AudioParam {
    this.events.push({ method: "set", time, value });
    return this as unknown as AudioParam;
  }
}

class FakeOscillator {
  readonly frequency = new FakeAudioParam();
  readonly starts: number[] = [];
  readonly stops: Array<number | undefined> = [];
  disconnectCount = 0;
  onended: (() => void) | null = null;
  type: OscillatorType = "sine";

  connect(): GainNode {
    return {} as GainNode;
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }

  start(time?: number): void {
    this.starts.push(time ?? 0);
  }

  stop(time?: number): void {
    this.stops.push(time);
  }
}

class FakeGain {
  readonly gain = new FakeAudioParam();
  disconnectCount = 0;

  connect(): AudioDestinationNode {
    return {} as AudioDestinationNode;
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }
}

class FakeAudioContext {
  readonly destination = {} as AudioDestinationNode;
  readonly gains: FakeGain[] = [];
  readonly oscillators: FakeOscillator[] = [];
  closeCount = 0;
  currentTime = 1;
  resumeCount = 0;
  state: AudioContextState = "suspended";

  close(): Promise<void> {
    this.closeCount += 1;
    this.state = "closed";
    return Promise.resolve();
  }

  createGain(): GainNode {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  resume(): Promise<void> {
    this.resumeCount += 1;
    this.state = "running";
    return Promise.resolve();
  }
}

describe("WebAudioPlayer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("constructs and resumes audio only after play, then schedules a safe envelope", async () => {
    const context = new FakeAudioContext();
    const factory = vi.fn(() => context as unknown as AudioContext);
    const player = new WebAudioPlayer(factory);
    const onPoint = vi.fn();
    const onComplete = vi.fn();

    expect(factory).not.toHaveBeenCalled();
    await player.play(buildSonificationTimeline([0, 10]), {
      onComplete,
      onPoint,
    });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.resumeCount).toBe(1);
    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators[0]!.starts[0]).toBeCloseTo(1.02, 5);
    expect(context.oscillators[0]!.stops[0]).toBeCloseTo(1.27, 5);
    expect(context.oscillators[1]!.starts[0]).toBeCloseTo(1.35, 5);
    expect(context.gains[0]!.gain.events).toEqual([
      { method: "set", time: 1.02, value: 0 },
      { method: "ramp", time: 1.03, value: 0.06 },
      { method: "set", time: 1.24, value: 0.06 },
      { method: "ramp", time: 1.27, value: 0 },
    ]);

    await vi.advanceTimersByTimeAsync(0);
    expect(onPoint).toHaveBeenLastCalledWith(0);
    await vi.advanceTimersByTimeAsync(330);
    expect(onPoint).toHaveBeenLastCalledWith(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("stops pending timers and every scheduled node immediately", async () => {
    const context = new FakeAudioContext();
    const player = new WebAudioPlayer(() => context as unknown as AudioContext);
    const onPoint = vi.fn();
    const onComplete = vi.fn();
    await player.play(buildSonificationTimeline([1, 2, 3]), {
      onComplete,
      onPoint,
    });

    player.stop();
    await vi.runAllTimersAsync();

    expect(onPoint).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    context.oscillators.forEach((oscillator) => {
      expect(oscillator.stops).toHaveLength(2);
      expect(oscillator.stops[1]).toBeUndefined();
      expect(oscillator.disconnectCount).toBe(1);
    });
    context.gains.forEach((gain) => expect(gain.disconnectCount).toBe(1));
  });

  it("cancels an old schedule before repeated play and closes on dispose", async () => {
    const context = new FakeAudioContext();
    const player = new WebAudioPlayer(() => context as unknown as AudioContext);
    const firstPoint = vi.fn();
    const secondPoint = vi.fn();

    await player.play(buildSonificationTimeline([1, 2]), {
      onComplete: vi.fn(),
      onPoint: firstPoint,
    });
    await player.play(buildSonificationTimeline([4, 8]), {
      onComplete: vi.fn(),
      onPoint: secondPoint,
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(firstPoint).not.toHaveBeenCalled();
    expect(secondPoint).toHaveBeenCalledWith(0);
    expect(context.oscillators).toHaveLength(4);
    expect(context.oscillators[0]!.stops).toHaveLength(2);

    player.dispose();
    expect(context.closeCount).toBe(1);
  });
});
