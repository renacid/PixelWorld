/** 基礎値を書き換えず、有効なバフだけを加算する共通ステータス計算。 */
import type { Actor, Attribute } from './types';
export function attackPower(a: Actor): number { const buffs=(a.buffs ?? []).filter(b=>b.remainingTurns>0); return (a.attack + buffs.reduce((sum,b)=>sum+(b.attackBonus??0),0)) * Math.max(1, ...buffs.map(b => b.attackMultiplier)); }
export function detection(a: Actor): number { return a.detectionRange + Math.max(0, ...(a.buffs ?? []).map(b => b.detectionBonus)); }
export function criticalChance(a: Actor, target: Actor, attribute: Attribute): number {
  const earth = target.afflictions.some(f => f.attribute === 'earth' || f.attribute === 'nature');
  return Math.min(1, (a.criticalRate ?? .05) * (attribute === 'neutral' && earth ? 2 : 1));
}

/** 同じIDは上書きし、強化量は重複させず持続時間だけ更新できる。 */
export function applyBuff(actor: Actor, buff: NonNullable<Actor['buffs']>[number]): void { actor.buffs=(actor.buffs??[]).filter(b=>b.id!==buff.id);actor.buffs.push({...buff}); }

/** 独立した移動不可効果を合成。霜蝕の解除は他の移動不可を解除しない。 */
export function movementLocked(a:Actor,action:number):boolean{return (a.movementLockedUntil??0)>action||(a.frostErosion?.rootUntil??0)>action;}
