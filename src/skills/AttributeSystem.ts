/** 属性の付着・消費・爆破と風散。実ダメージの整数化はGameSession.damageが担当。 */
import type { Actor, Attribute, GameEvent } from '../game/types';
import { occupied } from '../game/MapState';
export const ATTRIBUTE_DURATION: Record<Attribute, number> = { fire: 10, ice: 10, thunder: 10, earth: 10, wind: 0, neutral: 0, physical: 0, nature: 10 };
export type DamageHandler = (target: Actor, damage: number, attribute: Attribute, critical?: boolean) => void;
/** 先に融激倍率を適用してから整数化。反応で両属性を消費するため、後続ヒットは通常付着。 */
export function dealAttributeHit(target: Actor, raw: number, attribute: Attribute, action: number, actors: Actor[], damage: DamageHandler, events: GameEvent[], random: () => number, critical = false, allowSwirl = true): number {
  if (attribute === 'earth') attribute = 'nature';
  const opposite = attribute === 'fire' ? 'ice' : attribute === 'ice' ? 'fire' : null;
  const melt = !!opposite && target.afflictions.some(a => a.attribute === opposite);
  const amount = Math.max(0, Math.floor(raw * (melt ? 1.5 + random() * .5 : 1)));
  if (melt) {
    target.afflictions = target.afflictions.filter(a => a.attribute !== 'fire' && a.attribute !== 'ice');
    events.push({ type: 'reaction', position: { ...target.position }, attribute, text: '融激' });
  }
  damage(target, amount, attribute, critical);
  if (!melt) applyAttribute(target, attribute, amount, action, actors, damage, events, allowSwirl, random);
  return amount;
}
export function applyAttribute(target: Actor, attribute: Attribute, hitDamage: number, action: number, enemies: Actor[], damage: DamageHandler, events: GameEvent[], allowSwirl = true, random: () => number = () => 0): void {
  target.afflictions = target.afflictions.filter(a => a.attribute !== 'wind');
  if (attribute !== 'wind' && !ATTRIBUTE_DURATION[attribute]) return;
  const opposite = attribute === 'fire' ? 'thunder' : attribute === 'thunder' ? 'fire' : null;
  if (opposite && target.afflictions.some(a => a.attribute === opposite)) {
    target.afflictions = target.afflictions.filter(a => a.attribute !== 'fire' && a.attribute !== 'thunder');
    damage(target, hitDamage * 1.2, 'fire');
    events.push({ type: 'reaction', position: { ...target.position }, text: '爆破', attribute: 'fire' });
    return;
  }
  const spread = target.afflictions.filter(a => ['fire', 'ice', 'thunder'].includes(a.attribute));
  if (attribute === 'wind' && spread.length && allowSwirl) {
    // 元の炎・氷・雷と残り持続時間は維持し、風は付着させない。
    target.afflictions = target.afflictions.filter(a => a.attribute !== 'wind');
    events.push({ type: 'reaction', position: { ...target.position }, text: '風散', attribute: 'wind' });
    for (const other of enemies) {
      if (other.id === target.id || other.hp <= 0) continue;
      if (!occupied(other).some(c => occupied(target).some(t => Math.max(Math.abs(c.x - t.x), Math.abs(c.y - t.y)) <= 1))) continue;
      for (const source of spread) {
        const splash = Math.floor(hitDamage * .1);
        dealAttributeHit(other, splash, source.attribute, action, enemies, damage, events, random, false, false);
      }
    }
    return;
  }
  // 風は反応だけを起こし、反応しなくても付着しない。
  if (attribute === 'wind') return;
  if (['fire', 'ice', 'thunder'].includes(attribute)) target.afflictions = target.afflictions.filter(a => a.attribute !== 'wind');
  const existing = target.afflictions.find(a => a.attribute === attribute);
  if (existing) { existing.remainingTurns = ATTRIBUTE_DURATION[attribute]; existing.appliedAt = action; }
  else {
    if (target.afflictions.length >= 2) target.afflictions.shift();
    target.afflictions.push({ attribute, remainingTurns: ATTRIBUTE_DURATION[attribute], appliedAt: action });
  }
}
export function tickAttributes(actor: Actor, action: number): void {
  actor.afflictions = actor.afflictions.filter(a => { if (a.appliedAt < action) a.remainingTurns--; return a.attribute !== 'wind' && a.remainingTurns > 0; });
}
