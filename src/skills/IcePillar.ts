import { VECTORS, type SaveData, type Direction, type Point } from '../game/types';
import { canStand, same } from '../game/MapState';
import { effectiveLevel, connectionDamageMultiplier } from './SkillBag';
import { attackPower } from '../game/ActorStats';
/** プレビューと設置で同じ空き判定・追加順を使う。左右は向いている方向が基準。 */
export function icePillarCells(s:SaveData,direction:Direction,target?:Point):Point[]{
 const p=s.playerState,v=VECTORS[direction],side={x:-v.y,y:v.x},level=effectiveLevel(s.skillBag,s.skillLevels,'icePillar');
 const cells:Point[]=[],actors=[p,...s.allyStates,...s.enemyStates];
 const free=(c:Point)=>!cells.some(t=>same(t,c))&&canStand(s.mapState,{...p,cells:[{x:0,y:0}],id:'pillar-probe'},c,actors)&&!s.mapState.crystals?.some(o=>same(o.position,c))&&!s.mapState.objects.some(o=>same(o.position,c))&&!s.mapState.traps?.some(t=>same(t.position,c))&&!s.mapState.playerTraps?.some(t=>same(t.position,c))&&!s.mapState.fields.some(f=>same(f.position,c));
 const chosen=target&&Math.abs(target.x-p.position.x)+Math.abs(target.y-p.position.y)===1?target:{x:p.position.x+v.x,y:p.position.y+v.y};
 const first={x:chosen.x,y:chosen.y};if(!free(first))return cells;cells.push(first);
 if(level>=3){const second=[1,-1].map(sign=>({x:first.x+side.x*sign,y:first.y+side.y*sign})).find(free);if(second){cells.push(second);if(level>=5){const third=Object.values(VECTORS).map(d=>({x:second.x+d.x,y:second.y+d.y})).find(free);if(third)cells.push(third);}}}
 return cells;
}
export function placeIcePillars(s:SaveData,direction:Direction,target?:Point):Point[]{
 const cells=icePillarCells(s,direction,target),level=effectiveLevel(s.skillBag,s.skillLevels,'icePillar');
 const damage=attackPower(s.playerState)*.8*(1+(level-1)*.05)*connectionDamageMultiplier(s.skillBag,'icePillar');
 s.mapState.installations??=[];
 for(const [index,position] of cells.entries()){let id='ice-pillar-'+s.playerActionCount+'-'+index;while(s.mapState.installations.some(i=>i.id===id))id+='-new';s.mapState.installations.push({id,kind:'icePillar',position:{...position},spawned:0,sourceSkillId:'icePillar',placedAt:s.playerActionCount,remainingTurns:20,burstDamage:damage});}
 return cells;
}
