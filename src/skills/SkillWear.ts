/** 現在の抽選間隔を維持し、劣化ごとに元MPの10%、20%、30%…を個別に切り上げて加算。 */
import { SKILLS } from '../data/skills';
import type { SaveData, SkillId } from '../game/types';
import type { Random } from '../game/Random';
export function wearsOut(id: SkillId): boolean { return !['neutral', 'physical'].includes(SKILLS[id].attribute); }
/** 旧セーブは従来の加算幅から段階を推定。既に増えたMP量は変更しない。 */
export function wearStage(state:SaveData,id:SkillId):number{
 if(!wearsOut(id))return 0;
 const wear=state.skillWear?.[id];return wear?.stage??Math.ceil((wear?.extraMp??0)/Math.max(1,Math.ceil(SKILLS[id].mp/10)));
}
export function skillMp(state: SaveData, id: SkillId): number { return SKILLS[id].mp + (wearsOut(id) ? state.skillWear?.[id]?.extraMp ?? 0 : 0); }
export function skillMpLabel(state: SaveData, id: SkillId): string { const extra = wearsOut(id) ? state.skillWear?.[id]?.extraMp ?? 0 : 0; return `MP${skillMp(state, id)}${extra ? `（+${extra}）` : ''}`; }
export function wearSkill(state: SaveData, id: SkillId, rng: Random): boolean {
  if (!wearsOut(id)) return false;
  state.skillWear ??= {}; const wear = state.skillWear[id] ??= { uses: 0, extraMp: 0 };
  wear.uses++;
  if (wear.uses <= 3 || rng.next() >= .2) return false;
  wear.stage=wearStage(state,id)+1;
  wear.extraMp += Math.max(1, Math.ceil(SKILLS[id].mp * wear.stage / 10));
  wear.uses = 0; return true;
}
