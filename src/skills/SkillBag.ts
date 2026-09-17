/** ブロック回転・配置制約・同属性の辺連結と実効レベルの計算。 */
import { SKILLS } from '../data/skills';
import type { BagBlock, Point, SkillId } from '../game/types';
export function shape(skillId: SkillId, rotation = 0): Point[] {
  let cells = SKILLS[skillId].cells.map(c => ({ ...c }));
  for (let n = 0; n < ((rotation % 4) + 4) % 4; n++) cells = cells.map(c => ({ x: -c.y, y: c.x }));
  const minX = Math.min(...cells.map(c => c.x)), minY = Math.min(...cells.map(c => c.y));
  return cells.map(c => ({ x: c.x - minX, y: c.y - minY }));
}
export function blockCells(block: BagBlock): Point[] { return block.position ? shape(block.skillId, block.rotation).map(c => ({ x: c.x + block.position!.x, y: c.y + block.position!.y })) : []; }
/** 新規冒険は4×4。セル集合を使うため不定形でも配置判定を共有できる。 */
export function initialBagCells(size = 4): Point[] { return Array.from({ length: size * size }, (_, i) => ({ x: i % size, y: Math.floor(i / size) })); }
export function validPlacement(bag: BagBlock[], skillId: SkillId, position: Point, rotation: number, available: Point[] = initialBagCells(5)): boolean {
  const cells = blockCells({ skillId, position, rotation });
  const others = bag.filter(b => b.skillId !== skillId).flatMap(blockCells);
  return cells.every(c => available.some(p => p.x === c.x && p.y === c.y) && !others.some(o => c.x === o.x && c.y === o.y));
}
export function connectionBonus(bag: BagBlock[], skillId: SkillId): number {
  const start = bag.find(b => b.skillId === skillId && b.position);
  if (!start) return 0;
  const attribute = SKILLS[skillId].attribute;
  const group = new Set<SkillId>([skillId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of bag) {
      if (!block.position || group.has(block.skillId) || SKILLS[block.skillId].attribute !== attribute) continue;
      const linked = bag.filter(b => group.has(b.skillId)).flatMap(blockCells);
      if (blockCells(block).some(c => linked.some(o => Math.abs(c.x - o.x) + Math.abs(c.y - o.y) === 1))) { group.add(block.skillId); changed = true; }
    }
  }
  return group.size - 1;
}
export function effectiveLevel(_bag: BagBlock[], levels: Partial<Record<SkillId, number>>, id: SkillId, passiveBonus = 0): number { return (levels[id] ?? 1) + passiveBonus; }
export function autoPlace(bag: BagBlock[], id: SkillId, available: Point[] = initialBagCells(5)): void {
  const block = bag.find(b => b.skillId === id)!;
  for (const p of available) if (validPlacement(bag, id, p, block.rotation, available)) { block.position = { ...p }; return; }
}

/** 接続グループの他ブロック数に応じた別枠乗算。未指定の連結4以上は20%で上限。 */
export const CONNECTION_DAMAGE_BONUSES = [0, .05, .10, .20] as const;
export function connectionDamageMultiplier(bag: BagBlock[], id: SkillId): number {
  const count = connectionBonus(bag, id);
  return 1 + CONNECTION_DAMAGE_BONUSES[Math.min(count, CONNECTION_DAMAGE_BONUSES.length - 1)];
}
