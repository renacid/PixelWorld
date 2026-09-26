/** 地域共通の抽選表。個別ステージのloot/trapPool/enemyDropsで上書き。 */
import { COMMON_ITEMS, RARE_ITEMS, skillPool } from '../data/loot';
import { DEFAULT_TRAP_POOL } from '../data/traps';
import type { FloorSettings } from '../game/types';
export type RegionDefinition = { id: string; number: number; name: string; description: string; plannedStages: number; defaults: FloorSettings };
export const REGIONS: RegionDefinition[] = [
  { id: 'plains', number: 1, name: '平原', description: '草原を巡る、はじまりの冒険', plannedStages: 5, defaults: {
    loot: { items: COMMON_ITEMS, rareItems: RARE_ITEMS, skills: skillPool }, trapPool: DEFAULT_TRAP_POOL,
    trapPlacements: [{ count: 8 }],
  } },
  { id: 'forest', number: 2, name: '森', description: '入り組んだ獣道と魔物の集落', plannedStages: 5, defaults: {
    loot: { items: COMMON_ITEMS, rareItems: RARE_ITEMS, skills: skillPool }, trapPool: DEFAULT_TRAP_POOL,
    trapPlacements: [{ count: 18 }],
  } },
  { id: 'cave', number: 3, name: '洞窟', description: '土壁と結晶の奥へ続く冒険', plannedStages: 2, defaults: {
    loot: { items: COMMON_ITEMS, rareItems: RARE_ITEMS, skills: skillPool }, trapPool: DEFAULT_TRAP_POOL,
  } },
];
