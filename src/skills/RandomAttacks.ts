/** ランダム対象・連続突き。予告には全候補を表示し、発動時だけ乱数を消費する。 */
import { attackTargets } from './SkillResolver';
import { SKILLS } from '../data/skills';
import { attackPower, criticalChance } from '../game/ActorStats';
import { effectiveLevel, connectionDamageMultiplier } from './SkillBag';
import { dealAttributeHit, type DamageHandler } from './AttributeSystem';
import { hitInstallation } from '../game/InstallationSystem';
import { occupied, same, wall } from '../game/MapState';
import { VECTORS, type SaveData, type Direction, type SkillId, type GameEvent, type Point } from '../game/types';
import type { Random } from '../game/Random';
export function thrustLane(s:SaveData,direction:Direction,lateral:number):Point[]{
 const p=s.playerState.position,v=VECTORS[direction],cells:Point[]=[];
 for(let n=1;n<=2;n++){const c={x:p.x+v.x*n-v.y*lateral,y:p.y+v.y*n+v.x*lateral};if(wall(s.mapState,c))break;cells.push(c);}return cells;
}
export function randomAttack(s:SaveData,id:SkillId,direction:Direction,c:{rng:Random;events:GameEvent[];damage:DamageHandler;log:(s:string)=>void}):boolean{
 if(id!=='flurry'&&id!=='randomThunder')return false;
 const d=SKILLS[id],level=effectiveLevel(s.skillBag,s.skillLevels,id),power=attackPower(s.playerState)*(1+(level-1)*.05)*connectionDamageMultiplier(s.skillBag,id);
 const waves=id==='flurry'?3+(level>=3?1:0)+(level>=5?1:0):level>=5?4:level>=3?2:1;
 const used=new Set<string>();
 for(let i=0;i<waves;i++){
  const cells=id==='flurry'?thrustLane(s,direction,i===0?0:c.rng.int(-1,1)):[];
  const candidates=attackTargets(s,id!=='randomThunder').filter(a=>a.hp>0&&(id==='flurry'?occupied(a).some(p=>cells.some(q=>same(p,q))):!used.has(a.id)&&occupied(a).some(p=>Math.max(Math.abs(p.x-s.playerState.position.x),Math.abs(p.y-s.playerState.position.y))<=2)));
  const targets=id==='flurry'?candidates:candidates.length?[candidates[c.rng.int(0,candidates.length-1)]]:[];
  const start=c.events.length;
  c.events.push({type:'cast',actorId:s.playerState.id,position:{...s.playerState.position},target:targets[0]?.position??cells.at(-1),path:cells,skillId:id,attribute:d.attribute,sound:i===0?(id==='flurry'?'strike':'magicCast'):undefined,durationMs:240});
  for(const target of targets){used.add(target.id);if(hitInstallation(s,target.id,c))continue;
   const critical=c.rng.next()<criticalChance(s.playerState,target,d.attribute),ratio=id==='flurry'?.4+c.rng.next()*.2:.5+c.rng.next()*.3;
   dealAttributeHit(target,power*ratio*(critical?s.playerState.criticalMultiplier:1),d.attribute,s.playerActionCount,s.enemyStates,c.damage,c.events,()=>c.rng.next(),critical);
  }
  for(const event of c.events.slice(start))event.delayMs=(event.delayMs??0)+i*260;
 }return true;
}
