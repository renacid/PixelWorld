import type { Direction, Point, SaveData } from '../game/types';
import { VECTORS } from '../game/types';
import { canStand, same, wall } from '../game/MapState';
import { effectiveLevel, connectionDamageMultiplier } from './SkillBag';
import { attackPower } from '../game/ActorStats';
import type { Random } from '../game/Random';

/** 描画と命中判定で共有する扇形。各マスへの射線上にある壁・設置物の裏を除く。 */
export function breathCells(s:SaveData,direction:Direction):Point[]{
 const level=effectiveLevel(s.skillBag,s.skillLevels,'blizzardBreath'),depth=level>=5?6:level>=3?5:4;
 const p=s.playerState.position,v=VECTORS[direction],result:Point[]=[];
 for(let n=1;n<=depth;n++)for(let side=1-n;side<n;side++){
  const target={x:p.x+v.x*n-v.y*side,y:p.y+v.y*n+v.x*side};
  if(wall(s.mapState,target))continue;
  let clear=true;
  for(let step=1;step<n;step++){
   const lateral=Math.max(1-step,Math.min(step-1,Math.sign(side)*Math.round(Math.abs(side)*step/n)));
   const q={x:p.x+v.x*step-v.y*lateral,y:p.y+v.y*step+v.x*lateral};
   if(wall(s.mapState,q)||s.mapState.installations?.some(o=>same(o.position,q))){clear=false;break;}
  }
  if(clear)result.push(target);
 }
 return result;
}
/** 攻撃解決後に空き床を再評価。レベル・連結倍率は生成時に固定する。 */
export function placeBreathPillars(s:SaveData,cells:Point[],rng:Random){
 const level=effectiveLevel(s.skillBag,s.skillLevels,'blizzardBreath'),limit=level>=5?10:level>=3?5:3;
 const actors=[s.playerState,...s.allyStates,...s.enemyStates];
 const candidates=cells.filter(p=>canStand(s.mapState,{...s.playerState,id:'pillar-probe'},p,actors)
  &&![...s.mapState.objects,...s.mapState.traps??[],...s.mapState.playerTraps??[],...s.mapState.fields,...s.mapState.crystals??[],...s.mapState.gates??[]].some(o=>same(o.position,p)));
 const pillars=[];
 for(let i=0;i<limit&&candidates.length;i++){
  const position=candidates.splice(rng.int(0,candidates.length-1),1)[0];
  let id='breath-pillar-'+s.playerActionCount+'-'+i;
  while(s.mapState.installations?.some(o=>o.id===id))id+='x';
  const pillar={id,kind:'icePillar' as const,position,spawned:0,sourceSkillId:'blizzardBreath' as const,placedAt:s.playerActionCount,remainingTurns:20,burstDamage:attackPower(s.playerState)*.8*(1+(level-1)*.05)*connectionDamageMultiplier(s.skillBag,'blizzardBreath')};
  (s.mapState.installations??=[]).push(pillar);pillars.push(pillar);
 }
 return pillars;
}
