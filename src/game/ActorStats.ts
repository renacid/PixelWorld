/** 基礎値を書き換えず、有効なバフだけを加算する共通ステータス計算。 */
import type { Actor, Attribute } from './types';
export function attackPower(a: Actor): number { return a.attack * Math.max(1, ...(a.buffs ?? []).map(b => b.attackMultiplier)); }
export function detection(a: Actor): number { return a.detectionRange + Math.max(0, ...(a.buffs ?? []).map(b => b.detectionBonus)); }
export function criticalChance(a: Actor, target: Actor, attribute: Attribute): number {
  const nature = target.afflictions.some(f => f.attribute === 'nature' || f.attribute === 'earth');
  return Math.min(1, (a.criticalRate ?? .05) * (attribute === 'neutral' && nature ? 2 : 1));
}
