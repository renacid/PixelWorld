/** 必要経験値・成長率はここで調整。宝石による増加も現在の最大値に含める。 */
import type { SaveData, Point } from './types';
import type { Random } from './Random';
export const PROGRESSION = { maxLevel: 20, firstExperience: 10, experienceGrowth: .2, statGrowth: .1 };
export function requiredExperience(level: number): number {
  let required = PROGRESSION.firstExperience;
  for (let n = 1; n < level; n++) required += Math.ceil(required * PROGRESSION.experienceGrowth);
  return required;
}
/** 四辺に隣接する未解放セルから1個抽選。負座標が出たら配置ごと平行移動。 */
export function expandBag(state: SaveData, rng: Random): void {
  const cells = state.bagCells!, candidates = new Map<string, Point>();
  for (const p of cells) for (const d of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]) {
    const next = {x:p.x+d.x,y:p.y+d.y};
    if (!cells.some(c => c.x === next.x && c.y === next.y)) candidates.set(next.x + ',' + next.y, next);
  }
  cells.push([...candidates.values()][rng.int(0, candidates.size - 1)]);
  const dx = -Math.min(0, ...cells.map(p => p.x)), dy = -Math.min(0, ...cells.map(p => p.y));
  cells.forEach(p => {p.x += dx; p.y += dy;});
  state.skillBag.forEach(b => {if (b.position) {b.position.x += dx; b.position.y += dy;}});
}
