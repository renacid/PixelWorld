import { SKILLS } from '../data/skills';
import type { BagBlock, Point, SkillId } from '../game/types';
export function shape(skillId: SkillId, rotation = 0): Point[] {
  let cells = SKILLS[skillId].cells.map(c => ({ ...c }));
  for (let n = 0; n < ((rotation % 4) + 4) % 4; n++) cells = cells.map(c => ({ x: -c.y, y: c.x }));
  const minX = Math.min(...cells.map(c => c.x)), minY = Math.min(...cells.map(c => c.y));
  return cells.map(c => ({ x: c.x - minX, y: c.y - minY }));
}
export function blockCells(block: BagBlock): Point[] { return block.position ? shape(block.skillId, block.rotation).map(c => ({ x: c.x + block.position!.x, y: c.y + block.position!.y })) : []; }
export function validPlacement(bag: BagBlock[], skillId: SkillId, position: Point, rotation: number): boolean {
  const cells = blockCells({ skillId, position, rotation });
  const others = bag.filter(b => b.skillId !== skillId).flatMap(blockCells);
  return cells.every(c => c.x >= 0 && c.y >= 0 && c.x < 5 && c.y < 5 && !others.some(o => c.x === o.x && c.y === o.y));
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
export function effectiveLevel(bag: BagBlock[], levels: Partial<Record<SkillId, number>>, id: SkillId, passiveBonus = 0): number { return (levels[id] ?? 1) + connectionBonus(bag, id) + passiveBonus; }
export function autoPlace(bag: BagBlock[], id: SkillId): void {
  const block = bag.find(b => b.skillId === id)!;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (validPlacement(bag, id, { x, y }, block.rotation)) { block.position = { x, y }; return; }
}
