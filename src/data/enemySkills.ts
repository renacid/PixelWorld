import type { SoundCue } from './effects';
import type { Attribute } from '../game/types';
/** 敵専用スキル定義。発動範囲・確率・MPと効果をデータで変更できます。 */
export type EnemySkillDefinition = {
  cooldown?: number; diagonalRange?: number; visual: 'stone' | 'strike' | 'healingGlow'; sound: SoundCue; name: string; mpCost: number; chance: number; minRange: number; maxRange: number;
  target: 'player' | 'any'; cardinalOnly: boolean; requiresSight: boolean;
  effect: {type:'extraActions';count:number} | {type:'sweep';damageMin:number;damageMax:number;attribute:Attribute} | {type:'dash';steps:number} | (({ type: 'approachStrike'; steps: number } | { type: 'projectile' } | { type: 'melee' }) & { damageMin: number; damageMax: number; attribute: Attribute }) | { type: 'teleport'; radius: number } | { type: 'restoreMp'; amount: number; allowFull?: boolean } | { type: 'allyBuff'; radius: number; duration: number; attackMultiplier: number; detectionBonus: number };
};
export const ENEMY_SKILLS: Record<string, EnemySkillDefinition> = {
  flowAcceleration:{name:'流水加速',mpCost:3,chance:.3,minRange:0,maxRange:0,target:'any',cardinalOnly:false,requiresSight:false,visual:'healingGlow',sound:'magicCast',effect:{type:'extraActions',count:2}},
  sweepingStrike:{name:'薙ぎ払い',mpCost:3,chance:.3,minRange:1,maxRange:1,target:'any',cardinalOnly:false,requiresSight:false,visual:'strike',sound:'strike',effect:{type:'sweep',damageMin:.4,damageMax:.6,attribute:'physical'}},
  dash:{name:'加速',mpCost:3,chance:.1,minRange:2,maxRange:99,target:'any',cardinalOnly:false,requiresSight:false,visual:'strike',sound:'strike',effect:{type:'dash',steps:2}},
  // モンスター名を含めない共通ID。別の敵でもskillsに指定すれば再利用可能。
  quietGaze: { name: '静かに見つめている…', visual: 'healingGlow', sound: 'healing', mpCost: 0, chance: .1, minRange: 0, maxRange: 0, target: 'any', cardinalOnly: false, requiresSight: false, effect: { type: 'restoreMp', amount: 3, allowFull: true } },
  rockThrow: { name: '岩投げ', visual: 'stone', sound: 'stone', mpCost: 3, chance: .2, minRange: 1, maxRange: 3, target: 'any', cardinalOnly: true, requiresSight: true, effect: { type: 'projectile', damageMin: .4, damageMax: .6, attribute: 'earth' } },
  heavyStrike: { name: '強撃', visual: 'strike', sound: 'strike', mpCost: 6, chance: .2, minRange: 1, maxRange: 1, diagonalRange: 1, target: 'any', cardinalOnly: false, requiresSight: false, effect: { type: 'melee', damageMin: 1.2, damageMax: 1.5, attribute: 'physical' } },
  arrowShot: { name: '弓矢射出', visual: 'strike', sound: 'strike', mpCost: 1, cooldown: 1, chance: .5, minRange: 2, maxRange: 3, diagonalRange: 2, target: 'any', cardinalOnly: false, requiresSight: true, effect: { type: 'projectile', damageMin: 1.3, damageMax: 1.5, attribute: 'physical' } },
  fireball: { name: 'ファイアボール', visual: 'stone', sound: 'magicCast', mpCost: 3, cooldown: 1, chance: .3, minRange: 1, maxRange: 4, target: 'any', cardinalOnly: true, requiresSight: true, effect: { type: 'projectile', damageMin: 1.3, damageMax: 1.3, attribute: 'fire' } },
  teleport: { name: 'テレポート', visual: 'healingGlow', sound: 'healing', mpCost: 2, cooldown: 10, chance: .1, minRange: 0, maxRange: 2, target: 'any', cardinalOnly: false, requiresSight: false, effect: { type: 'teleport', radius: 2 } },
  prayer: { name: 'お祈り', visual: 'healingGlow', sound: 'healing', mpCost: 0, cooldown: 5, chance: .2, minRange: 0, maxRange: 0, target: 'any', cardinalOnly: false, requiresSight: false, effect: { type: 'restoreMp', amount: 3 } },
  forestBlessing: { name: '森の加護', visual: 'healingGlow', sound: 'healing', mpCost: 3, chance: .2, minRange: 0, maxRange: 2, target: 'any', cardinalOnly: false, requiresSight: false, effect: { type: 'allyBuff', radius: 2, duration: 10, attackMultiplier: 1.3, detectionBonus: 2 } },
  stoneThrow: {
    name: '投石', visual: 'stone', sound: 'stone', mpCost: 1, chance: .25, minRange: 1, maxRange: 3,
    target: 'any', cardinalOnly: true, requiresSight: true,
    effect: { type: 'projectile', damageMin: .5, damageMax: .7, attribute: 'earth' },
  },
  lunge: {
    name: '飛びかかり', visual: 'strike', sound: 'strike', mpCost: 5, chance: .2, minRange: 2, maxRange: 2,
    target: 'player', cardinalOnly: true, requiresSight: true,
    effect: { type: 'approachStrike', steps: 1, damageMin: .4, damageMax: .6, attribute: 'physical' },
  },
};
/** 旧セーブのスキルIDを共通名へ移行。今後も旧IDをここへ登録できます。 */
export const ENEMY_SKILL_ALIASES: Record<string, string> = { goblinStone: 'stoneThrow', wolfLunge: 'lunge' };
export const canonicalEnemySkillId = (id: string): string => ENEMY_SKILL_ALIASES[id] ?? id;
