/** プレイヤー→味方→敵の状態差分をアニメーションへ変換。ワープのみ瞬間移動。 */
import type { Actor, GameEvent, TurnFrame } from '../game/types';
export type AnimationStep = TurnFrame & { before: Actor[]; start: number; duration: number };
export function interpolate(from: number, to: number, progress: number): number { const t = Math.max(0, Math.min(1, progress)); return from + (to - from) * (t * t * (3 - 2 * t)); }
export class TurnAnimation {
  steps: AnimationStep[] = [];
  duration = 0;
  constructor(before: Actor[], frames: TurnFrame[], visible: (actor: Actor) => boolean, eventVisible: (event: GameEvent, actors: Actor[]) => boolean = () => true) {
    for (const source of frames) {
      // 画面外だけで完結する演出には待ち時間を付けない。行動結果は維持する。
      const frame = { ...source, events: source.events.filter(event => eventVisible(event, [...before, ...source.actors])) };
      const changed = frame.events.length > 0 || frame.actors.some(a => { const b = before.find(o => o.id === a.id); return (!b || a.position.x !== b.position.x || a.position.y !== b.position.y) && (visible(a) || !!b && visible(b)); });
      if (frame.phase === 'player' || changed) {
        const duration = Math.max(frame.events.some(e => e.type === 'cast') ? 580 : frame.events.some(e => e.type === 'attack') ? 340 : 230, ...frame.events.filter(e => e.type === 'trap' || e.skillId === 'chainLightning').map(e => (e.delayMs ?? 0) + (e.durationMs ?? 550)));
        this.steps.push({ ...frame, before, start: this.duration, duration }); this.duration += duration;
      }
      before = frame.actors;
    }
  }
  sample(elapsed: number): { step: AnimationStep; progress: number; actors: Actor[] } | null {
    const step = this.steps.find(s => elapsed < s.start + s.duration);
    if (!step) return null;
    const progress = Math.max(0, (elapsed - step.start) / step.duration);
    const ids = new Set([...step.before, ...step.actors].map(a => a.id));
    const actors: Actor[] = [];
    for (const id of ids) {
      const prev = step.before.find(a => a.id === id), next = step.actors.find(a => a.id === id);
      if (!next && progress >= .7) continue;
      const a = { ...(next ?? prev!) };
      if (prev && next) {
        const moveProgress = step.events.some(e => e.type === 'trap') ? Math.min(1, (elapsed - step.start) / 230) : progress;
        a.position = { x: interpolate(prev.position.x, next.position.x, moveProgress), y: interpolate(prev.position.y, next.position.y, moveProgress) };
        if (step.events.some(e => e.skillId === 'warp' && e.actorId === id)) a.position = { ...(progress < .5 ? prev.position : next.position) };
        if (progress < .55) { a.hp = prev.hp; a.afflictions = prev.afflictions; }
      }
      const attack = step.events.find(e => (e.type === 'attack' || e.type === 'cast') && e.actorId === id);
      if (attack?.target && attack.skillId !== 'warp' && attack.enemySkillId !== 'dash') {
        const dx = attack.target.x - attack.position.x, dy = attack.target.y - attack.position.y, len = Math.hypot(dx, dy) || 1;
        const lunge = Math.sin(Math.min(1, progress / .7) * Math.PI) * .22;
        a.position = { x: a.position.x + dx / len * lunge, y: a.position.y + dy / len * lunge };
      }
      actors.push(a);
    }
    return { step, progress, actors };
  }
  events(): { event: GameEvent; delay: number; duration: number; phase: TurnFrame['phase'] }[] {
    return this.steps.flatMap(step => step.events.map((event, i) => ({ event, delay: step.start + (event.delayMs ?? (['damage', 'reaction', 'defeat'].includes(event.type) ? step.duration * .5 + i % 3 * 40 : 0)), duration: event.durationMs ?? step.duration, phase: step.phase })));
  }
}
