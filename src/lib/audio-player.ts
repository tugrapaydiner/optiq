import {
  SONIFICATION_TIMING,
  type SonificationTimelinePoint,
} from "@/lib/sonification";

export type AudioPlaybackCallbacks = {
  onComplete: () => void;
  onPoint: (pointIndex: number) => void;
};

export interface AudioPlayer {
  dispose(): void;
  play(
    timeline: readonly SonificationTimelinePoint[],
    callbacks: AudioPlaybackCallbacks,
  ): Promise<void>;
  stop(): void;
}

type AudioContextFactory = () => AudioContext;

type ScheduledNode = {
  gain: GainNode;
  oscillator: OscillatorNode;
};

const START_BUFFER_SECONDS = 0.02;

export class WebAudioPlayer implements AudioPlayer {
  private context: AudioContext | null = null;
  private readonly createContext: AudioContextFactory;
  private generation = 0;
  private nodes = new Set<ScheduledNode>();
  private timers = new Set<number>();

  constructor(createContext: AudioContextFactory = () => new AudioContext()) {
    this.createContext = createContext;
  }

  async play(
    timeline: readonly SonificationTimelinePoint[],
    callbacks: AudioPlaybackCallbacks,
  ): Promise<void> {
    if (timeline.length === 0) {
      throw new RangeError("Audio playback requires at least one timeline point.");
    }

    this.stop();
    const generation = ++this.generation;
    const context = this.getContext();
    if (context.state === "suspended") await context.resume();
    if (generation !== this.generation) return;

    const baseTime = context.currentTime + START_BUFFER_SECONDS;
    for (const point of timeline) {
      this.scheduleTone(context, baseTime, point);
      this.scheduleTimer(generation, point.startMs, () => {
        callbacks.onPoint(point.index);
      });
    }

    const lastPoint = timeline.at(-1)!;
    this.scheduleTimer(
      generation,
      lastPoint.startMs + lastPoint.durationMs,
      () => {
        this.disconnectNodes(false);
        callbacks.onComplete();
      },
    );
  }

  stop(): void {
    this.generation += 1;
    this.clearTimers();
    this.disconnectNodes(true);
  }

  dispose(): void {
    this.stop();
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private getContext(): AudioContext {
    if (!this.context || this.context.state === "closed") {
      this.context = this.createContext();
    }
    return this.context;
  }

  private scheduleTone(
    context: AudioContext,
    baseTime: number,
    point: SonificationTimelinePoint,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startTime = baseTime + point.startMs / 1000;
    const endTime = startTime + point.durationMs / 1000;
    const attackEnd = startTime + SONIFICATION_TIMING.attackMs / 1000;
    const releaseStart = Math.max(
      attackEnd,
      endTime - SONIFICATION_TIMING.releaseMs / 1000,
    );

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(point.frequency, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(SONIFICATION_TIMING.gain, attackEnd);
    gain.gain.setValueAtTime(SONIFICATION_TIMING.gain, releaseStart);
    gain.gain.linearRampToValueAtTime(0, endTime);
    oscillator.connect(gain);
    gain.connect(context.destination);

    const scheduledNode = { gain, oscillator };
    this.nodes.add(scheduledNode);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.nodes.delete(scheduledNode);
    };
    oscillator.start(startTime);
    oscillator.stop(endTime);
  }

  private scheduleTimer(
    generation: number,
    delayMs: number,
    callback: () => void,
  ): void {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      if (generation === this.generation) callback();
    }, delayMs);
    this.timers.add(timer);
  }

  private clearTimers(): void {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
  }

  private disconnectNodes(stopImmediately: boolean): void {
    this.nodes.forEach(({ gain, oscillator }) => {
      oscillator.onended = null;
      if (stopImmediately) {
        try {
          oscillator.stop();
        } catch {
          // A naturally ended oscillator is already silent.
        }
      }
      oscillator.disconnect();
      gain.disconnect();
    });
    this.nodes.clear();
  }
}
