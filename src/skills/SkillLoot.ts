import { SKILLS } from '../data/skills';
import type { SaveData, SkillId } from '../game/types';
/** 所持中のスキルの最大セル数+1。回転や配置状態では個数は変わらない。 */
export function skillLootLimit(state:SaveData):number{return Math.max(0,...state.skillBag.map(b=>SKILLS[b.skillId].cells.length))+1;}
export function canRollSkill(state:SaveData,id:SkillId):boolean{return SKILLS[id].cells.length<=skillLootLimit(state);}

/** スキル種類数とは独立して先に抽選する上限。所持上限が小さい場合はその値に丸める。 */
export const SKILL_SIZE_ROLLS = [
 { maxCells:3, weight:40 }, { maxCells:5, weight:30 },
 { maxCells:6, weight:20 }, { maxCells:7, weight:10 },
] as const;
/** 宝箱・魔導書共通の二段階抽選。候補なしの場合だけ1セルずつ上限を広げる。 */
export function rollSkillBySize(state:SaveData,entries:import('../data/loot').Weighted<SkillId>[],rng:import('../game/Random').Random):SkillId|undefined {
 const limit=skillLootLimit(state),eligible=entries.filter(e=>e.weight>0&&Number.isFinite(e.weight)&&SKILLS[e.value].cells.length<=limit);
 if(!eligible.length)return undefined;
 let roll=rng.next()*SKILL_SIZE_ROLLS.reduce((sum,t)=>sum+t.weight,0);
 let cap:number=SKILL_SIZE_ROLLS[SKILL_SIZE_ROLLS.length-1].maxCells;
 for(const tier of SKILL_SIZE_ROLLS){roll-=tier.weight;if(roll<0){cap=tier.maxCells;break;}}
 cap=Math.min(cap,limit);
 let pool=eligible.filter(e=>SKILLS[e.value].cells.length<=cap);
 while(!pool.length&&cap<limit){cap++;pool=eligible.filter(e=>SKILLS[e.value].cells.length<=cap);}
 let choice=rng.next()*pool.reduce((sum,e)=>sum+e.weight,0);
 for(const entry of pool){choice-=entry.weight;if(choice<0)return entry.value;}
 return pool[pool.length-1].value;
}
