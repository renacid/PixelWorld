import type { Actor, Attribute, GameEvent } from '../game/types';
import { occupied } from '../game/MapState';
export const ATTRIBUTE_DURATION: Record<Attribute, number> = { fire: 10, ice: 10, thunder: 10, earth: 10, wind: 10, neutral: 0, physical: 0 };
export type DamageHandler = (target: Actor, damage: number, attribute: Attribute, critical?: boolean) => void;
export function applyAttribute(target: Actor, attribute: Attribute, hitDamage: number, action: number, enemies: Actor[], damage: DamageHandler, events: GameEvent[], allowSwirl = true): void {
  if (!ATTRIBUTE_DURATION[attribute]) return;
  const opposite = attribute === 'fire' ? 'thunder' : attribute === 'thunder' ? 'fire' : null;
  if (opposite && target.afflictions.some(a => a.attribute === opposite)) {
    target.afflictions = target.afflictions.filter(a => a.attribute !== 'fire' && a.attribute !== 'thunder');
    damage(target, hitDamage * 1.2, 'fire');
    events.push({ type: 'reaction', position: { ...target.position }, text: '爆破', attribute: 'fire' });
    return;
  }
  const spread = target.afflictions.filter(a => ['fire', 'ice', 'thunder'].includes(a.attribute));
  if (attribute === 'wind' && spread.length && allowSwirl) {
    target.afflictions = target.afflictions.filter(a => !['fire', 'ice', 'thunder', 'wind'].includes(a.attribute));
    events.push({ type: 'reaction', position: { ...target.position }, text: '風散', attribute: 'wind' });
    for (const other of enemies) {
      if (other.id === target.id || other.hp <= 0) continue;
      if (!occupied(other).some(c => occupied(target).some(t => Math.max(Math.abs(c.x - t.x), Math.abs(c.y - t.y)) <= 1))) continue;
      for (const source of spread) {
        const splash = hitDamage * .1;
        damage(other, splash, source.attribute);
        applyAttribute(other, source.attribute, splash, action, enemies, damage, events, false);
      }
    }
    return;
  }
  // Wind is consumed when it meets an elemental aura; only non-reacting auras coexist.
  if (['fire', 'ice', 'thunder'].includes(attribute)) target.afflictions = target.afflictions.filter(a => a.attribute !== 'wind');
  const existing = target.afflictions.find(a => a.attribute === attribute);
  if (existing) { existing.remainingTurns = ATTRIBUTE_DURATION[attribute]; existing.appliedAt = action; }
  else {
    if (target.afflictions.length >= 2) target.afflictions.shift();
    target.afflictions.push({ attribute, remainingTurns: ATTRIBUTE_DURATION[attribute], appliedAt: action });
  }
}
export function tickAttributes(actor: Actor, action: number): void {
  actor.afflictions = actor.afflictions.filter(a => { if (a.appliedAt < action) a.remainingTurns--; return a.remainingTurns > 0; });
}
