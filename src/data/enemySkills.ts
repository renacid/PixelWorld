import type { SoundCue } from './effects';
import type { Attribute } from '../game/types';
/** 敵専用スキル定義。発動範囲・確率・MPと効果をデータで変更できます。 */
export type EnemySkillDefinition = {
  visual: 'stone' | 'strike' | 'healingGlow'; sound: SoundCue; name: string; mpCost: number; chance: number; minRange: number; maxRange: number;
  target: 'player' | 'any'; cardinalOnly: boolean; requiresSight: boolean;
  effect: (({ type: 'approachStrike'; steps: number } | { type: 'projectile' }) & { damageMin: number; damageMax: number; attribute: Attribute }) | { type: 'allyBuff'; radius: number; duration: number; attackMultiplier: number; detectionBonus: number };
};
export const ENEMY_SKILLS: Record<string, EnemySkillDefinition> = {
  forestBlessing: { name: '森の加護', visual: 'healingGlow', sound: 'healing', mpCost: 3, chance: .2, minRange: 0, maxRange: 2, target: 'any', cardinalOnly: false, requiresSight: false, effect: { type: 'allyBuff', radius: 2, duration: 10, attackMultiplier: 1.3, detectionBonus: 2 } },
  stoneThrow: {
    name: '投石', visual: 'stone', sound: 'stone', mpCost: 1, chance: .25, minRange: 1, maxRange: 3,
    target: 'any', cardinalOnly: true, requiresSight: true,
    effect: { type: 'projectile', damageMin: .5, damageMax: .7, attribute: 'nature' },
  },
  lunge: {
    name: '飛びかかり', visual: 'strike', sound: 'strike', mpCost: 5, chance: .2, minRange: 2, maxRange: 2,
    target: 'player', cardinalOnly: true, requiresSight: true,
    effect: { type: 'approachStrike', steps: 1, damageMin: .4, damageMax: .5, attribute: 'physical' },
  },
};
/** 旧セーブのスキルIDを共通名へ移行。今後も旧IDをここへ登録できます。 */
export const ENEMY_SKILL_ALIASES: Record<string, string> = { goblinStone: 'stoneThrow', wolfLunge: 'lunge' };
export const canonicalEnemySkillId = (id: string): string => ENEMY_SKILL_ALIASES[id] ?? id;
