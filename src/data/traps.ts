import type { Point } from '../game/types';
import type { ChestTier, Weighted } from './loot';

export type TrapId = 'treasure' | 'bearTrap' | 'fireMine' | 'rockfall' | 'healing' | 'wolfTerritory';
import type { EnemyKind } from './enemies';
import type { TrapVisual, SoundCue } from './effects';
export type { TrapVisual, SoundCue } from './effects';
export type TrapDefinition = {
  name: string; visual: TrapVisual; sound: SoundCue;
  effect: { type: 'chest'; tiers: Weighted<ChestTier>[] } | { type: 'root'; turns: number } |
    { type: 'blast'; radius: number; damage: number } | { type: 'rocks'; radius: number; tiles: number; hits: number; damage: number } |
    { type: 'heal'; amount: number } | { type: 'summonPerimeter'; radius: number; count: number; enemy: EnemyKind };
};
export const TRAPS: Record<TrapId, TrapDefinition> = {
  wolfTerritory: { name: '狼の縄張り', visual: 'summonRing', sound: 'howl', effect: { type: 'summonPerimeter', radius: 4, count: 3, enemy: 'wolf' } },
  treasure: { name: '宝箱トラップ', visual: 'chestBurst', sound: 'treasure', effect: { type: 'chest', tiers: [{ value: 'wood', weight: 60 }, { value: 'iron', weight: 25 }, { value: 'silver', weight: 12 }, { value: 'gold', weight: 3 }] } },
  bearTrap: { name: 'トラばさみ', visual: 'snare', sound: 'snap', effect: { type: 'root', turns: 1 } },
  fireMine: { name: '炎地雷', visual: 'fireBlast', sound: 'explosion', effect: { type: 'blast', radius: 1, damage: 3 } },
  rockfall: { name: '落石トラップ', visual: 'fallingRocks', sound: 'rocks', effect: { type: 'rocks', radius: 2, tiles: 5, hits: 3, damage: 1 } },
  healing: { name: '回復トラップ', visual: 'healingGlow', sound: 'healing', effect: { type: 'heal', amount: 5 } },
};
export type TrapInstance = { id: string; trapId: TrapId; position: Point; triggered: boolean };
/** region省略で全体。複数ルールで局所密集も指定できます。重なりは避けます。 */
export type TrapPlacement = { region?: { x: number; y: number; width: number; height: number }; count: number; pool: Weighted<TrapId>[] };
export const DEFAULT_TRAP_POOL: Weighted<TrapId>[] = [
  { value: 'treasure', weight: 2 }, { value: 'bearTrap', weight: 2 }, { value: 'fireMine', weight: 2 },
  { value: 'rockfall', weight: 1 }, { value: 'healing', weight: 2 }, { value: 'wolfTerritory', weight: 1 },
];
