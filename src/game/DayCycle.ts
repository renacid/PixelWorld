/** 昼夜は行動数とは別に保存し、睡眠時だけ朝に戻す。 */
import type { SaveData } from './types';
export const DAY_CYCLE = { evening: 80, night: 100, respawnCount: 3, midnight: 150, revivalInterval: 30, nightExperience: .5, midnightExperience: .25 };
/** 1～3日=1体、4～7日=2体、8～11日=4体… HPだけ4ずつ上昇。 */
export function reaperRules(day: number) { const tier=Math.floor(Math.max(1,day)/4);return {count:2**tier,hp:13+4*tier,attack:4}; }
export function sleepHpRatio(fatigue: number): number { return Math.max(0, 5-Math.min(5,Math.max(0,fatigue)))/5; }
export function timeOfDay(state: SaveData): 'day' | 'evening' | 'night' {
  const count = state.daylightCount ?? 0;
  return count >= DAY_CYCLE.night ? 'night' : count >= DAY_CYCLE.evening ? 'evening' : 'day';
}
