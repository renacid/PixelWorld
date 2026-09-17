/** 使用6回目以降に劣化抽選。基礎MPを基準に加算し、重複取得・レベルアップでも劣化は維持する。 */
import { SKILLS } from '../data/skills';
import type { SaveData, SkillId } from '../game/types';
import type { Random } from '../game/Random';
export function wearsOut(id: SkillId): boolean { return !['neutral', 'physical'].includes(SKILLS[id].attribute); }
export function skillMp(state: SaveData, id: SkillId): number { return SKILLS[id].mp + (wearsOut(id) ? state.skillWear?.[id]?.extraMp ?? 0 : 0); }
export function skillMpLabel(state: SaveData, id: SkillId): string { const extra = wearsOut(id) ? state.skillWear?.[id]?.extraMp ?? 0 : 0; return `MP${skillMp(state, id)}${extra ? `（+${extra}）` : ''}`; }
export function wearSkill(state: SaveData, id: SkillId, rng: Random): boolean {
  if (!wearsOut(id)) return false;
  state.skillWear ??= {}; const wear = state.skillWear[id] ??= { uses: 0, extraMp: 0 };
  wear.uses++;
  if (wear.uses <= 3 || rng.next() >= .2) return false;
  wear.extraMp += Math.max(1, Math.ceil(SKILLS[id].mp * .1)); wear.uses = 0; return true;
}
