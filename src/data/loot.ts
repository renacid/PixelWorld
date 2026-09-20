import type { ItemId, SkillId } from '../game/types';

export type Loot = { type: 'item'; id: ItemId } | { type: 'skill'; id: SkillId };
/** 各行を独立抽選。chanceは0〜1の実確率です（重みではありません）。 */
export type DropEntry = { loot: Loot; chance: number; count?: number };
export type Weighted<T> = { value: T; weight: number };
/** 未指定の表は共通表を継承。空配列は抽選なし。固定報酬は別枠です。 */
export type LootPools = { items?: Weighted<ItemId>[]; rareItems?: Weighted<ItemId>[]; skills?: Weighted<SkillId>[] };
export type ChestTier = 'wood' | 'iron' | 'silver' | 'gold';
export type ChestDefinition = {
  name: string; color: string; trim: string;
  items: { chance: number; min: number; max: number; rareChance: number };
  skills: { chance: number; min: number; max: number; pool: Weighted<SkillId>[] };
};
export const COMMON_ITEMS: Weighted<ItemId>[] = [{ value: 'potion', weight: 1 }, { value: 'ether', weight: 1 }, { value: 'hourglass', weight: 1 }];
export const RARE_ITEMS: Weighted<ItemId>[] = [{ value: 'powerPotion', weight: 1 },{ value: 'healingPotion', weight: 2 }, { value: 'etherMedium', weight: 2 }, { value: 'scope', weight: 1 }, { value: 'summon', weight: 1 }];
export const skillPool: Weighted<SkillId>[] = ['iceLance','fireWall','tornadoSummon','earthquake','summonSpirit', 'iceShield', 'sweep', 'vacuumSlash', 'chainLightning', 'fireball', 'thunder', 'tornado', 'firerain', 'warp', 'icestone', 'groundbreak'].map(value => ({ value: value as SkillId, weight: 1 }));
/** 個数・追加確率・レア抽選をここで調整。金のスキル抽選は重複なしです。 */
export const CHESTS: Record<ChestTier, ChestDefinition> = {
  wood: { name: '宝箱(木)', color: '#c68a4d', trim: '#f1c58a', items: { chance: 1, min: 1, max: 2, rareChance: 0 }, skills: { chance: 0, min: 0, max: 0, pool: skillPool } },
  iron: { name: '宝箱(鉄)', color: '#75858e', trim: '#b4c6cb', items: { chance: 1, min: 1, max: 2, rareChance: .01 }, skills: { chance: .25, min: 1, max: 1, pool: skillPool } },
  silver: { name: '宝箱(銀)', color: '#afc7d0', trim: '#f3fbff', items: { chance: .4, min: 1, max: 1, rareChance: .05 }, skills: { chance: 1, min: 1, max: 1, pool: skillPool } },
  gold: { name: '宝箱(金)', color: '#dfa739', trim: '#fff2a3', items: { chance: .9, min: 1, max: 2, rareChance: .5 }, skills: { chance: 1, min: 2, max: 3, pool: skillPool } },
};
