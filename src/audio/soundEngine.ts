/**
 * Procedural Web Audio API sound synthesizer for Spider Solitaire.
 * Zero external audio assets required; gracefully degrades if AudioContext is blocked.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private playNoiseBurst(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    filterFreq: number,
    filterQ: number,
    gainPeak: number
  ): void {
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.45));
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);
    filter.Q.setValueAtTime(filterQ, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(startTime);
    source.stop(startTime + duration);
  }

  private playTone(
    ctx: AudioContext,
    startTime: number,
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gainPeak: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /** Soft crisp paper snap for card flip */
  public playCardFlip(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playNoiseBurst(ctx, now, 0.06, 2200, 1.4, 0.14);
    this.playTone(ctx, now, 340, 520, 0.055, 'triangle', 0.035);
  }

  /** Felt thud + paper slide when placing cards */
  public playCardPlace(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playNoiseBurst(ctx, now, 0.055, 1300, 1.1, 0.16);
    this.playTone(ctx, now, 165, 88, 0.065, 'sine', 0.09);
  }

  /** Rapid fanned deal swoosh for 10 cards */
  public playDeal(count = 10): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const steps = Math.min(count, 10);
    for (let i = 0; i < steps; i++) {
      const t = now + i * 0.035;
      this.playNoiseBurst(ctx, t, 0.045, 1800 + i * 70, 1.3, 0.1);
    }
  }

  /** Riffle shuffle cascade for new games */
  public playShuffle(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 9; i++) {
      const t = now + i * 0.032;
      this.playNoiseBurst(ctx, t, 0.04, 1500 + (i % 3) * 400, 1.6, 0.11);
    }
  }

  /** Subtle golden chime when triggering hint */
  public playHint(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(ctx, now, 784, 784, 0.14, 'sine', 0.06);
    this.playTone(ctx, now + 0.07, 1046.5, 1046.5, 0.22, 'sine', 0.07);
  }

  /** Low gentle buzz for illegal placement or blocked deal */
  public playError(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(ctx, now, 150, 115, 0.12, 'sawtooth', 0.045);
    this.playTone(ctx, now + 0.09, 135, 98, 0.13, 'sawtooth', 0.04);
  }

  /** Ascending major arpeggio when completing a K->A suit run */
  public playCompleteRun(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.055;
      this.playTone(ctx, t, freq, freq, 0.28, 'triangle', 0.08);
    });
  }

  /** Celebratory chord fanfare upon winning all 8 runs */
  public playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const fanfare = [
      { f: 523.25, t: 0, d: 0.25 },
      { f: 659.25, t: 0.1, d: 0.25 },
      { f: 783.99, t: 0.2, d: 0.25 },
      { f: 1046.5, t: 0.32, d: 0.65 },
      { f: 1318.51, t: 0.36, d: 0.65 },
      { f: 1567.98, t: 0.4, d: 0.7 },
    ];
    fanfare.forEach((n) => {
      this.playTone(ctx, now + n.t, n.f, n.f, n.d, 'triangle', 0.09);
    });
  }
}

export const soundEngine = new SoundEngine();
