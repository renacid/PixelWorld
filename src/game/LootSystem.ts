import { ITEMS } from '../data/items';
import { CHESTS, COMMON_ITEMS, RARE_ITEMS, type ChestTier, type DropEntry, type Loot, type Weighted } from '../data/loot';
import type { GroundObject, MapState, Point } from './types';
import type { Random } from './Random';

/** 抽選はセッションのシード付き乱数だけを使い、再開で中身が変わることを防ぎます。 */
export function weighted<T>(entries: Weighted<T>[], rng: Random): T {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (!entries.length || total <= 0 || entries.some(e => !Number.isFinite(e.weight) || e.weight < 0)) throw new Error('抽選表の重みが不正です');
  let cursor = rng.next() * total;
  for (const entry of entries) { cursor -= entry.weight; if (cursor < 0) return entry.value; }
  return entries[entries.length - 1].value;
}
export function rollDrops(entries: DropEntry[], rng: Random, floor = 1): Loot[] {
  return entries.flatMap(e => rng.next() < e.chance * (e.loot.type === 'item' ? rarityFactor(e.loot.id, floor) : 1) ? Array.from({ length: e.count ?? 1 }, () => ({ ...e.loot })) : []);
}
export function rollChest(tier: ChestTier, rng: Random, guaranteed: Loot[] = [], floor = 1): Loot[] {
  const d = CHESTS[tier], result: Loot[] = guaranteed.map(e => ({ ...e }));
  const skillIds = new Set(result.filter(e => e.type === 'skill').map(e => e.id));
  if (rng.next() < d.skills.chance) {
    const count = Math.max(skillIds.size, rng.int(d.skills.min, d.skills.max));
    let pool = d.skills.pool.filter(e => !skillIds.has(e.value));
    while (skillIds.size < count && pool.length) { const id = weighted(pool, rng); result.push({ type: 'skill', id }); skillIds.add(id); pool = pool.filter(e => e.value !== id); }
  }
  if (rng.next() < d.items.chance) {
    const count = rng.int(d.items.min, d.items.max), existing = result.filter(e => e.type === 'item').length;
    for (let i = existing; i < count; i++) result.push({ type: 'item', id: weighted((rng.next() < d.items.rareChance * Math.min(1, .25 + (floor - 1) * .375) ? RARE_ITEMS : COMMON_ITEMS).map(e => ({ ...e, weight: e.weight * rarityFactor(e.value, floor) })), rng) });
  }
  return result;
}
export function makeChest(id: string, position: Point, tier: ChestTier, rng: Random, guaranteed: Loot[] = [], floor = 1): GroundObject {
  return { id, type: 'chest', position: { ...position }, chestTier: tier, contents: rollChest(tier, rng, guaranteed, floor) };
}
export function floorLoot(id: string, position: Point, loot: Loot): GroundObject {
  return { id, position: { ...position }, type: loot.type, ...(loot.type === 'item' ? { itemId: loot.id } : { skillId: loot.id }) };
}
/** 旧マップの固定報酬を保持します。開封時に再抽選しません。 */
export function legacyLoot(object: GroundObject): Loot[] {
  const result: Loot[] = [];
  if (object.skillId) result.push({ type: 'skill', id: object.skillId });
  for (const id of object.skillIds ?? []) if (!result.some(e => e.type === 'skill' && e.id === id)) result.push({ type: 'skill', id });
  if (object.itemId) result.push({ type: 'item', id: object.itemId });
  return result;
}
/** 新しいマップ用。固定報酬を優先し、不足分を箱の定義で生成して保存します。 */
export function initializeChests(map: MapState, rng: Random, floor = 1): void {
  for (const obj of map.objects.filter(o => o.type === 'chest')) {
    const fixed = legacyLoot(obj), skills = fixed.filter(e => e.type === 'skill').length;
    obj.chestTier ??= skills >= 2 ? 'gold' : skills ? 'silver' : 'wood';
    obj.contents ??= rollChest(obj.chestTier, rng, fixed, floor);
  }
}

/** 上位ランクほど浅層の抽選を抑制。3層以降は段階的に解放する。 */
export function rarityFactor(id: import('./types').ItemId, floor: number): number { return Math.min(1, (.25 + (floor - 1) * .375) ** (ITEMS[id].rareRank - 1)); }
