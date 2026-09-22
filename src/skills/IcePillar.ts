import { VECTORS, type SaveData, type Direction, type Point } from '../game/types';
import { canStand, same } from '../game/MapState';
import { effectiveLevel, connectionDamageMultiplier } from './SkillBag';
import { attackPower } from '../game/ActorStats';
import type { Random } from '../game/Random';
/** プレビューと設置で同じ空き判定・追加順を使う。左右は向いている方向が基準。 */
// export function icePillarCells(s:SaveData,direction:Direction,target?:Point):Point[]{
export function icePillarCells(s: SaveData,direction: Direction,rng: Random,target?: Point): Point[]{
 const p=s.playerState,v=VECTORS[direction],level=effectiveLevel(s.skillBag,s.skillLevels,'icePillar');
 const cells:Point[]=[],actors=[p,...s.allyStates,...s.enemyStates];
 const free=(c:Point)=>!cells.some(t=>same(t,c))&&canStand(s.mapState,{...p,cells:[{x:0,y:0}],id:'pillar-probe'},c,actors)&&!s.mapState.crystals?.some(o=>same(o.position,c))&&!s.mapState.objects.some(o=>same(o.position,c))&&!s.mapState.traps?.some(t=>same(t.position,c))&&!s.mapState.playerTraps?.some(t=>same(t.position,c))&&!s.mapState.fields.some(f=>same(f.position,c));
 const chosen=target&&Math.abs(target.x-p.position.x)+Math.abs(target.y-p.position.y)===1?target:{x:p.position.x+v.x,y:p.position.y+v.y};
 const first={x:chosen.x,y:chosen.y};if(!free(first))return cells;cells.push(first);
 if (level >= 3) {
  // 1本目の上下左右4方向をすべて探索
  const secondCandidates = Object.values(VECTORS)
    .map(d => ({
    x: first.x + d.x,
    y: first.y + d.y
    }))
    .filter(free);

 // 空きマスの中から完全ランダムに1マス抽選
 const second = secondCandidates.length
    ? secondCandidates[rng.int(0, secondCandidates.length - 1)]
    : undefined;

 if (second) {
    cells.push(second);

    if (level >= 5) {
    const thirdCandidates = Object.values(VECTORS)
    .map(d => ({
    x: second.x + d.x,
    y: second.y + d.y
    }))
    .filter(free);

    const third = thirdCandidates.length
    ? thirdCandidates[rng.int(0, thirdCandidates.length - 1)]
    : undefined;

    if (third) cells.push(third);
    }
  }
 } 
 return cells;
}
// export function placeIcePillars(s:SaveData,direction:Direction,target?:Point):Point[]{
export function placeIcePillars(s: SaveData,direction: Direction,rng: Random,target?: Point): Point[] {
 const cells=icePillarCells(s,direction,rng,target),level=effectiveLevel(s.skillBag,s.skillLevels,'icePillar');
 const damage=attackPower(s.playerState)*.8*(1+(level-1)*.05)*connectionDamageMultiplier(s.skillBag,'icePillar');
 s.mapState.installations??=[];
 for(const [index,position] of cells.entries()){let id='ice-pillar-'+s.playerActionCount+'-'+index;while(s.mapState.installations.some(i=>i.id===id))id+='-new';s.mapState.installations.push({id,kind:'icePillar',position:{...position},spawned:0,sourceSkillId:'icePillar',placedAt:s.playerActionCount,remainingTurns:20,burstDamage:damage});}
 return cells;
}
