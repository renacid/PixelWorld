import type { ItemId, Point } from '../game/types';
import type { EnemyKind } from './enemies';
import type { Weighted } from './loot';
export type InstallationKind = 'pot' | 'goblinNest' | 'icePillar';
/** 確率は0～1。chanceDecayは出現成功1体ごとの確率低下幅（巣穴ごと）。poolのweightは種類間の相対比率。 */
export type InstallationDefinition = { name: string; drop?: { chance: number; pool: Weighted<ItemId>[] }; spawn?: { radius: number; chance: number; chanceDecay?: number; max: number; pool: Weighted<EnemyKind>[] } };
export const INSTALLATIONS: Record<InstallationKind, InstallationDefinition> = {
  icePillar: { name: '氷柱' },
  pot: { name: '壺', drop: { chance: .35, pool: [{value:'potion',weight:5},{value:'ether',weight:4},{value:'hourglass',weight:1}] } },
  goblinNest: { name: 'ゴブリンの巣穴', spawn: { radius:7, chance:.25, chanceDecay:.05, max:5, pool:[{value:'goblin',weight:5},{value:'goblinArcher',weight:3},{value:'goblinMage',weight:1},{value:'goblinFighter',weight:1}] } },
};
/** overridesで巣穴ごとにも抽選表・上限を変更可能。spawnedは累計で保存。 */
export type Installation = { sourceSkillId?: import('../game/types').SkillId; placedAt?:number; remainingTurns?:number; burstDamage?:number; id:string; kind:InstallationKind; position:Point; spawned:number; requiredForGoal?:boolean; overrides?:Partial<InstallationDefinition> };
export type InstallationPlacement = { kind:InstallationKind; count:number; nearWall?:boolean; region?:{x:number;y:number;width:number;height:number}; overrides?:Partial<InstallationDefinition> };
export const installationDefinition = (i:Installation):InstallationDefinition => ({...INSTALLATIONS[i.kind],...i.overrides});
