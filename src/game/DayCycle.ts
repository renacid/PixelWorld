/** 昼夜は行動数とは別に保存し、睡眠時だけ朝に戻す。 */
import type { SaveData } from './types';
export const DAY_CYCLE = { evening: 80, night: 100, respawnCount: 3, midnight: 150, revivalInterval: 30, nightExperience: .5, midnightExperience: .25 };
export function timeOfDay(state: SaveData): 'day' | 'evening' | 'night' {
  const count = state.daylightCount ?? 0;
  return count >= DAY_CYCLE.night ? 'night' : count >= DAY_CYCLE.evening ? 'evening' : 'day';
}
