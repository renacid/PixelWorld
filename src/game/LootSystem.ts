import { canRollSkill, rollSkillBySize } from '../skills/SkillLoot';
import type { SaveData } from './types';
import { ITEMS } from '../data/items';
import { DEEP_ITEM_BALANCE, BOOKMARK_LOOT, CHESTS, COMMON_ITEMS, RARE_ITEMS, type ChestTier, type DropEntry, type Loot, type Weighted, type LootPools } from '../data/loot';
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
  return entries.flatMap(e => rng.next() < Math.min(1,e.chance * (e.loot.type === 'item' ? rarityFactor(e.loot.id, floor)*(floor>=DEEP_ITEM_BALANCE.fromFloor?(ITEMS[e.loot.id].rareRank===1?DEEP_ITEM_BALANCE.rank1DropMultiplier:ITEMS[e.loot.id].rareRank===2?DEEP_ITEM_BALANCE.rank2DropMultiplier:1):1) : 1)) ? Array.from({ length: e.count ?? 1 }, () => ({ ...e.loot })) : []);
}
export function rollChest(tier: ChestTier, rng: Random, guaranteed: Loot[] = [], floor = 1, pools?: LootPools): Loot[] {
  const d = CHESTS[tier], result: Loot[] = guaranteed.map(e => ({ ...e }));
  const skillIds = new Set(result.filter(e => e.type === 'skill').map(e => e.id));
  if (rng.next() < d.skills.chance) {
    const count = Math.max(skillIds.size, rng.int(d.skills.min, d.skills.max));
    let pool = (pools?.skills ?? d.skills.pool).filter(e => e.weight > 0 && !skillIds.has(e.value));
    while (skillIds.size < count && pool.length) { const id = weighted(pool, rng); result.push({ type: 'skill', id }); skillIds.add(id); pool = pool.filter(e => e.value !== id); }
  }
  if (rng.next() < d.items.chance) {
    const count = rng.int(d.items.min, d.items.max), existing = result.filter(e => e.type === 'item').length;
    for (let i = existing; i < count; i++) {
      let pool = rng.next() < d.items.rareChance * Math.min(1, .25 + (floor - 1) * .375) ? (pools?.rareItems ?? RARE_ITEMS) : (pools?.items ?? COMMON_ITEMS);
      const rank2=(pools?.rareItems??RARE_ITEMS).filter(e=>e.weight>0&&ITEMS[e.value].rareRank===2);
      if(floor>=DEEP_ITEM_BALANCE.fromFloor&&pool.some(e=>e.weight>0&&ITEMS[e.value].rareRank===1)&&rank2.length&&rng.next()<DEEP_ITEM_BALANCE.rank2TransferChance)pool=rank2;
      if (pool.some(e => e.weight > 0)) result.push({ type: 'item', id: weighted(pool.map(e => ({ ...e, weight: e.weight * rarityFactor(e.value, floor) })), rng) });
    }
  }
  return result;
}
export function makeChest(id: string, position: Point, tier: ChestTier, rng: Random, guaranteed: Loot[] = [], floor = 1, pools?: LootPools): GroundObject {
  return { id, type: 'chest', skillIds:guaranteed.filter(e=>e.type==='skill').map(e=>e.id), position: { ...position }, chestTier: tier, contents: rollChest(tier, rng, guaranteed, floor, pools) };
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
    // contents を直接指定した箱は完全固定。開封時のランダム置換も行いません。
    if (obj.contents !== undefined) { obj.fixedContents = true; obj.randomSkillsResolved = true; }
    const fixed = legacyLoot(obj), skills = fixed.filter(e => e.type === 'skill').length;
    obj.chestTier ??= skills >= 2 ? 'gold' : skills ? 'silver' : 'wood';
    obj.contents ??= rollChest(obj.chestTier, rng, fixed, floor, map.loot);
  }
}

/** 上位ランクほど浅層の抽選を抑制。3層以降は段階的に解放する。 */
export function rarityFactor(id: import('./types').ItemId, floor: number): number { return Math.min(1, (.25 + (floor - 1) * .375) ** (ITEMS[id].rareRank - 1)); }

/** 開封時の所持スキルで候補を制限。固定報酬は対象外。箱1つの抽選上限は途中で変えない。 */
export function resolveChestSkills(state:SaveData,chest:GroundObject,rng:Random):void{
 if(chest.randomSkillsResolved)return;
 const fixed=new Set(legacyLoot(chest).filter(e=>e.type==='skill').map(e=>e.id));
 const used=new Set(fixed),def=CHESTS[chest.chestTier??'wood'];
 let pool=(state.mapState.loot?.skills??def.skills.pool).filter(e=>e.weight>0&&canRollSkill(state,e.value)&&!used.has(e.value));
 chest.contents=(chest.contents??legacyLoot(chest)).flatMap((loot):Loot[]=>{
  if(loot.type!=='skill'||fixed.has(loot.id))return [loot];
  if(rng.next()<BOOKMARK_LOOT.replacementChance)return [{type:'item',id:weighted(BOOKMARK_LOOT.pool,rng)}];
  if(!pool.length)return [];
  const id=rollSkillBySize(state,pool,rng);if(!id)return [];used.add(id);pool=pool.filter(e=>!used.has(e.value));return [{type:'skill',id}];
 });
 chest.randomSkillsResolved=true;
}
