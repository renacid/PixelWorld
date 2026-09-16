/** スキルの対象・射線・ワープ候補を計算。プレビューと実発動で同じ判定を共有。 */
import { SKILLS } from '../data/skills';
import { effectiveLevel } from './SkillBag';
import { canStand, occupied, same, wall } from '../game/MapState';
import { VECTORS, type Direction, type Point, type SaveData, type SkillId } from '../game/types';
export type TargetPreview = { cells: Point[]; blocked: Point | null; targetIds: string[] };
/** 指定地点型の選択範囲。実効レベルの拡張をUIと実発動で共有。 */
export function selectionRange(state: SaveData, id: SkillId): number {
  const d = SKILLS[id], upgrade = d.rangeUpgrade;
  return upgrade && effectiveLevel(state.skillBag, state.skillLevels, id) >= upgrade.level ? upgrade.range : d.range;
}
export function validSkillTarget(state: SaveData, id: SkillId, target?: Point): boolean {
  if (SKILLS[id].target !== 'pointArea') return true;
  const p = state.playerState.position;
  return !!target && Number.isInteger(target.x) && Number.isInteger(target.y) && target.x >= 0 && target.y >= 0 && target.x < state.mapState.width && target.y < state.mapState.height && Math.max(Math.abs(target.x - p.x), Math.abs(target.y - p.y)) <= selectionRange(state, id);
}
export function previewSkill(state: SaveData, id: SkillId, direction: Direction, target?: Point): TargetPreview {
  const definition = SKILLS[id], p = state.playerState.position;
  const result: TargetPreview = { cells: [], blocked: null, targetIds: [] };
  if (definition.target === 'groundTrap') {
    result.cells.push({ ...p });
  } else if (definition.target === 'pointArea') {
    if (!validSkillTarget(state, id, target)) return result;
    const radius = definition.areaRadius ?? 1;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const cell = { x: target!.x + dx, y: target!.y + dy };
      if (!wall(state.mapState, cell)) result.cells.push(cell);
    }
    result.targetIds = state.enemyStates.filter(e => e.hp > 0 && occupied(e).some(c => result.cells.some(t => same(c, t)))).map(e => e.id);
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
    result.targetIds = state.enemyStates.filter(e => e.hp > 0 && occupied(e).some(c => result.cells.some(t => same(c, t)))).map(e => e.id);
  } else {
    const v = VECTORS[direction];
    for (let n = 1; n <= definition.range; n++) {
      const cell = { x: p.x + v.x * n, y: p.y + v.y * n };
      if (wall(state.mapState, cell)) { result.blocked = cell; break; }
      result.cells.push(cell);
      const enemy = state.enemyStates.find(e => e.hp > 0 && occupied(e).some(c => same(c, cell)));
      if (enemy) { result.targetIds.push(enemy.id); break; }
    }
  }
  return result;
}
