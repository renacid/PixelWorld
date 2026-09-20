import { ITEMS } from '../data/items';
import { effectiveLevel } from '../skills/SkillBag';
import { actor } from '../actors/Actor';
import { actorDefinition } from '../data/enemies';
import { canStand,occupied,same } from './MapState';
import type { SaveData,Point,Actor } from './types';
export function summonCells(s:SaveData):Point[]{const cells:Point[]=[],p=s.playerState.position;for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const c={x:p.x+x,y:p.y+y};if((x||y)&&canStand(s.mapState,s.playerState,c,[...s.allyStates,...s.enemyStates])&&!s.mapState.objects.some(o=>same(o.position,c))&&!s.mapState.traps?.some(t=>!t.triggered&&same(t.position,c))&&!s.mapState.playerTraps?.some(t=>same(t.position,c))&&!s.mapState.fields.some(f=>same(f.position,c)))cells.push(c);}return cells;}
export function createSpirit(s:SaveData,kind:'sprite'|'greaterSprite',position:Point):Actor{let id='ally-'+s.playerActionCount+'-'+s.allyStates.length;while(s.allyStates.some(a=>a.id===id))id+='-new';const ally=actor(id,kind,position);ally.remainingLife=actorDefinition(kind).lifetime??30;ally.detectionRange=7;s.allyStates.push(ally);return ally;}

/** Lv3以降はレア2以上が必要。同じ最低レア階級の道具からランダムに1個消費。 */
export function summonMedia(s:SaveData):number[]{const minimum=effectiveLevel(s.skillBag,s.skillLevels,'summonSpirit')>=3?2:1;const slots=s.itemSlots.map((id,index)=>({index,rank:ITEMS[id].rareRank})).filter(e=>e.rank>=minimum);const rank=Math.min(...slots.map(e=>e.rank));return slots.filter(e=>e.rank===rank).map(e=>e.index);}
