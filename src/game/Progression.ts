/** 必要経験値・成長率はここで調整。宝石による増加も現在の最大値に含める。 */
import type { SaveData, Point } from './types';
import type { Random } from './Random';
export const PROGRESSION = { maxBagSide: 9, maxLevel: 20, firstExperience: 10, experienceGrowth: .25, statGrowth: .8 };
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
    const width=Math.max(next.x,...cells.map(c=>c.x))-Math.min(next.x,...cells.map(c=>c.x))+1;
    const height=Math.max(next.y,...cells.map(c=>c.y))-Math.min(next.y,...cells.map(c=>c.y))+1;
    if(width>PROGRESSION.maxBagSide||height>PROGRESSION.maxBagSide)continue;
    if (!cells.some(c => c.x === next.x && c.y === next.y)) candidates.set(next.x + ',' + next.y, next);
  }
  if(!candidates.size)return;
  cells.push([...candidates.values()][rng.int(0, candidates.size - 1)]);
  const dx = -Math.min(0, ...cells.map(p => p.x)), dy = -Math.min(0, ...cells.map(p => p.y));
  cells.forEach(p => {p.x += dx; p.y += dy;});
  state.skillBag.forEach(b => {if (b.position) {b.position.x += dx; b.position.y += dy;}});
}
