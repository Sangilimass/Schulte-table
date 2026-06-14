/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundSynth {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCorrect() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      // Nice soft sweet drop/pop sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1); // Octave up

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("Web Audio interaction restricted or unsupported.", e);
    }
  }

  playIncorrect() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      // Low buzz disappointment sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {
      console.warn("Web Audio play failed", e);
    }
  }

  playSuccess() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // Arpeggio chord of success (C major major seventh)
      const notes = [261.63, 329.63, 392.00, 493.88, 523.25]; // C4, E4, G4, B4, C5
      
      notes.forEach((freq, index) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);
        
        gain.gain.setValueAtTime(0, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, now + index * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.4);
        
        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.45);
      });
    } catch (e) {
      console.warn("Web Audio chime failed", e);
    }
  }
}

export const synth = new SoundSynth();
