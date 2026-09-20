import { SKILLS } from '../data/skills';
import type { SaveData, SkillId } from '../game/types';
/** 所持中のスキルの最大セル数+1。回転や配置状態では個数は変わらない。 */
export function skillLootLimit(state:SaveData):number{return Math.max(0,...state.skillBag.map(b=>SKILLS[b.skillId].cells.length))+1;}
export function canRollSkill(state:SaveData,id:SkillId):boolean{return SKILLS[id].cells.length<=skillLootLimit(state);}
