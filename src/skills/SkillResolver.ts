import { SKILLS } from '../data/skills';
import { occupied, same, wall } from '../game/MapState';
import { VECTORS, type Direction, type Point, type SaveData, type SkillId } from '../game/types';
export type TargetPreview = { cells: Point[]; blocked: Point | null; targetIds: string[] };
export function previewSkill(state: SaveData, id: SkillId, direction: Direction): TargetPreview {
  const definition = SKILLS[id], p = state.playerState.position;
  const result: TargetPreview = { cells: [], blocked: null, targetIds: [] };
  if (definition.target === 'area') {
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
