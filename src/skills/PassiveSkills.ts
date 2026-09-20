import { SKILLS } from '../data/skills';
import { effectiveLevel,connectionDamageMultiplier } from './SkillBag';
import type { BagBlock,SaveData,SkillId } from '../game/types';
export function passiveChance(state:SaveData,id:SkillId,bag:BagBlock[]=state.skillBag):number{
 const rule=SKILLS[id].passive;if(!rule)return 0;
 return Math.min(1,rule.chance+(effectiveLevel(bag,state.skillLevels,id)-1)*rule.chancePerLevel);
}
export function passiveDamageScale(state:SaveData,id:SkillId):number{return SKILLS[id].multiplier*(1+(effectiveLevel(state.skillBag,state.skillLevels,id)-1)*.05)*connectionDamageMultiplier(state.skillBag,id);}
