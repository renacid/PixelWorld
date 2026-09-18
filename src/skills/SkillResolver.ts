/** スキルの対象・射線・ワープ候補を計算。プレビューと実発動で同じ判定を共有。 */
import { SKILLS } from '../data/skills';
import { effectiveLevel } from './SkillBag';
import { canStand, occupied, same, wall } from '../game/MapState';
import { VECTORS, type Direction, type Point, type SaveData, type SkillId } from '../game/types';
export function attackTargets(state:SaveData) {
 return [...state.enemyStates, ...(state.mapState.installations??[]).map(i=>({...state.playerState,id:i.id,position:i.position,cells:[{x:0,y:0}],hp:1}))];
}
export type TargetPreview = { cells: Point[]; blocked: Point | null; targetIds: string[] };
/** 指定地点型の選択範囲。実効レベルの拡張をUIと実発動で共有。 */
export function selectionRange(state: SaveData, id: SkillId): number {
  const d = SKILLS[id], upgrade = d.rangeUpgrade;
  return upgrade && effectiveLevel(state.skillBag, state.skillLevels, id) >= upgrade.level ? upgrade.range : d.range;
}
export function validSkillTarget(state: SaveData, id: SkillId, target?: Point): boolean {
  if (SKILLS[id].target === 'enemyWarp') return !!target && !!vacuumTarget(state,target);
  if (SKILLS[id].target !== 'pointArea') return true;
  const p = state.playerState.position;
  return !!target && Number.isInteger(target.x) && Number.isInteger(target.y) && target.x >= 0 && target.y >= 0 && target.x < state.mapState.width && target.y < state.mapState.height && Math.max(Math.abs(target.x - p.x), Math.abs(target.y - p.y)) <= selectionRange(state, id);
}
export function previewSkill(state: SaveData, id: SkillId, direction: Direction, target?: Point): TargetPreview {
  const definition = SKILLS[id], p = state.playerState.position;
  const result: TargetPreview = { cells: [], blocked: null, targetIds: [] };
  if (definition.target === 'sweep') {
    const f=VECTORS[direction], side={x:-f.y,y:f.x};
    for(const [forward,lateral] of [[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {const c={x:p.x+f.x*forward+side.x*lateral,y:p.y+f.y*forward+side.y*lateral};if(!wall(state.mapState,c))result.cells.push(c);}
    result.targetIds=attackTargets(state).filter(e=>e.hp>0&&occupied(e).some(c=>result.cells.some(t=>same(c,t)))).map(e=>e.id);
  } else if (definition.target === 'enemyWarp') {
    const enemy=target?vacuumTarget(state,target):undefined;
    if(enemy){result.cells=occupied(enemy);result.targetIds=[enemy.id];}
  } else if (definition.target === 'chain') {
    let origins = occupied(state.playerState); const hit = new Set<string>();
    for (let i=0;i<chainHitLimit(state);i++) { const enemy = nextChainTarget(state, origins, hit); if (!enemy) break; hit.add(enemy.id); result.targetIds.push(enemy.id); result.cells.push({...enemy.position}); origins=occupied(enemy); }
    if (!result.cells.length) for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)if(x||y){const c={x:p.x+x,y:p.y+y};if(!wall(state.mapState,c))result.cells.push(c);}
  } else if (definition.target === 'groundTrap') {
    result.cells.push({ ...p });
  } else if (definition.target === 'pointArea') {
    if (!validSkillTarget(state, id, target)) return result;
    const radius = definition.areaRadius ?? 1;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const cell = { x: target!.x + dx, y: target!.y + dy };
      if (!wall(state.mapState, cell)) result.cells.push(cell);
    }
    result.targetIds = attackTargets(state).filter(e => e.hp > 0 && occupied(e).some(c => result.cells.some(t => same(c, t)))).map(e => e.id);
  } else if (definition.target === 'warp') {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) continue;
      const cell = { x: p.x + dx, y: p.y + dy };
      if (canStand(state.mapState, state.playerState, cell, [...state.enemyStates, ...state.allyStates]) && !state.mapState.objects.some(o => same(o.position, cell))) result.cells.push(cell);
    }
  } else if (definition.target === 'area') {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue;
      const cell = { x: p.x + dx, y: p.y + dy };
      if (!wall(state.mapState, cell)) result.cells.push(cell);
    }
    result.targetIds = attackTargets(state).filter(e => e.hp > 0 && occupied(e).some(c => result.cells.some(t => same(c, t)))).map(e => e.id);
  } else {
    const v = VECTORS[direction];
    for (let n = 1; n <= definition.range; n++) {
      const cell = { x: p.x + v.x * n, y: p.y + v.y * n };
      if (wall(state.mapState, cell)) { result.blocked = cell; break; }
      result.cells.push(cell);
      const enemy = attackTargets(state).find(e => e.hp > 0 && occupied(e).some(c => same(c, cell)));
      if (enemy) { result.targetIds.push(enemy.id); break; }
    }
  }
  return result;
}

/** 一発につき一体へ連鎖。大型敵は占有セルの外周から距離を測る。 */
export function chainHitLimit(state: SaveData): number { const level=effectiveLevel(state.skillBag,state.skillLevels,'chainLightning');return level>=5?5:level>=3?3:2; }
export function nextChainTarget(state: SaveData, origins: Point[], hit: Set<string>) {
  return attackTargets(state).filter(e=>e.hp>0&&!hit.has(e.id)).map(e=>({e,d:Math.min(...occupied(e).flatMap(c=>origins.map(p=>Math.max(Math.abs(p.x-c.x),Math.abs(p.y-c.y)))))})).filter(t=>t.d===1).sort((a,b)=>a.d-b.d||a.e.id.localeCompare(b.e.id))[0]?.e;
}

/** 真空切り：敵の占有外周から、旅人が移動可能な空きマスを列挙。 */
export function vacuumDestinations(state:SaveData, enemy:import('../game/types').Actor):Point[]{
 const found=new Map<string,Point>();
 for(const c of occupied(enemy))for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
  const p={x:c.x+x,y:c.y+y};
  if((x||y)&&!same(p,state.playerState.position)&&canStand(state.mapState,state.playerState,p,[...state.enemyStates,...state.allyStates])&&!state.mapState.objects.some(o=>same(o.position,p)))found.set(p.x+','+p.y,p);
 }
 return [...found.values()];
}
export function vacuumTarget(state:SaveData,target:Point){
 const p=state.playerState.position;
 if(!Number.isInteger(target.x)||!Number.isInteger(target.y)||Math.max(Math.abs(target.x-p.x),Math.abs(target.y-p.y))>2)return undefined;
 return state.enemyStates.find(e=>e.hp>0&&occupied(e).some(c=>same(c,target))&&vacuumDestinations(state,e).length>0);
}
