/** Web Audioで効果音を合成。ユーザー操作後に開始し、無効設定を尊重。 */
import type { GameEvent } from '../game/types';
import { SOUND_CUES } from '../data/effects';
/** Small synthesized effects, no downloads; AudioContext starts inside a user gesture. */
export class SoundManager {
  enabled = true;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Audio) return;
        this.context = new Audio(); this.master = this.context.createGain(); this.master.gain.value = .12; this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Sound support must never block an action. */ }
  }
  setEnabled(enabled: boolean): void { this.enabled = enabled; if (this.master && this.context) this.master.gain.setValueAtTime(enabled ? .12 : 0, this.context.currentTime); if (enabled) this.unlock(); }
  private tone(frequency: number, end: number, duration: number, type: OscillatorType, delay = 0, volume = .7): void {
    if (!this.enabled || !this.context || !this.master) return;
    const c = this.context, time = c.currentTime + delay, osc = c.createOscillator(), gain = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, time); osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), time + duration);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + .008); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(time); osc.stop(time + duration + .02); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  step(): void { this.tone(150, 80, .065, 'triangle', 0, .25); }
  ui(): void { this.tone(700, 1000, .055, 'sine', 0, .3); }
  play(event: GameEvent, delayMs = 0): void {
    const t = delayMs / 1000;
    if (event.sound) {
      for (const note of SOUND_CUES[event.sound]) this.tone(note.from, note.to, note.duration, note.wave, t + (note.delay ?? 0), note.volume ?? .5);
      return;
    }
    if (event.type === 'levelup') { [659, 880, 1047, 1319, 1760].forEach((f, i) => this.tone(f, f * 1.01, .4, 'sine', t + i * .1, .55)); }
    else if (event.type === 'pickup') { [523, 659, 784].forEach((f, i) => this.tone(f, f, .14, 'sine', t + i * .09)); }
    else if (event.type === 'cast') {
      if (event.skillId === 'warp') { this.tone(160, 1400, .22, 'sine', t); this.tone(1400, 350, .25, 'sine', t + .25); }
      if (event.skillId === 'attack') this.tone(550, 90, .15, 'triangle', t);
      if (event.skillId === 'fireball') this.tone(150, 650, .26, 'sawtooth', t, .3);
      if (event.skillId === 'thunder') { this.tone(1100, 60, .22, 'square', t, .3); this.tone(180, 50, .25, 'sawtooth', t + .12, .3); }
      if (event.skillId === 'tornado') this.tone(280, 900, .4, 'sine', t, .5);
      if (event.skillId === 'firerain') [0, .15, .3].forEach(d => this.tone(650, 100, .18, 'triangle', t + d));
    } else if (event.type === 'attack') this.tone(250, 80, .13, 'triangle', t);
    else if (event.type === 'reaction') this.tone(event.text === '爆破' ? 110 : 750, 45, .28, 'sawtooth', t, .4);
    else if (event.type === 'heal') this.tone(400, 900, .3, 'sine', t);
    else if (event.type === 'defeat') this.tone(400, 100, .19, 'square', t, .2);
    else if (event.type === 'damage' && event.actorId === 'player') this.tone(180, 55, .14, 'square', t, .25);
  }
}
