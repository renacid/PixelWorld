import { ENEMY_SKILLS, type EnemySkillDefinition } from '../data/enemySkills';
import { canStand, distance, lineOfSight, occupied, same, wall } from '../game/MapState';
import type { Random } from '../game/Random';
import { VECTORS, type Actor, type Direction, type GameEvent, type MapState, type Point } from '../game/types';
import { attackPower } from '../game/ActorStats';

type Context = { action: number; allies: Actor[]; map: MapState; actors: Actor[]; rng: Random; events: GameEvent[]; damage: (target: Actor, amount: number, attribute: import("../game/types").Attribute, critical?: boolean, label?: string) => void; log: (message: string) => void };
type PreparedAction = { position: Point; facing: Direction; origin?: Point; impact?: Point; path?: Point[] };
/** 効果ごとの事前検証。新効果はここに分岐を追加し、抽選前に実行可能性を確定します。 */
function prepare(skill: EnemySkillDefinition, caster: Actor, target: Actor, context: Context): PreparedAction | null {
  if (skill.effect.type === 'projectile') {
    // 直線を1セルずつ走査。壁・最初のキャラで止まり、手前の敵仲間を貫通しません。
    for (const origin of occupied(caster)) for (const facing of caster.directions) {
      const v = VECTORS[facing], path: Point[] = [];
      for (let range = 1; range <= skill.maxRange; range++) {
        const cell = { x: origin.x + v.x * range, y: origin.y + v.y * range };
        if (wall(context.map, cell)) break;
        path.push(cell);
        const hit = context.actors.find(a => a.id !== caster.id && a.hp > 0 && occupied(a).some(p => same(p, cell)));
        if (hit) {
          if (hit.id === target.id && range >= skill.minRange) return { position: { ...caster.position }, facing, origin, impact: cell, path };
          break;
        }
      }
    }
    return null;
  }
  if (skill.effect.type === 'approachStrike') {
    for (const facing of caster.directions) {
      const v = VECTORS[facing]; let position = { ...caster.position }, valid = true;
      for (let step = 0; step < skill.effect.steps; step++) {
        position = { x: position.x + v.x, y: position.y + v.y };
        if (!canStand(context.map, caster, position, context.actors)) { valid = false; break; }
      }
      if (valid && occupied(caster, position).some(c => occupied(target).some(t => distance(c, t) === 1))) return { position, facing };
    }
  }
  return null;
}
/** 条件成立時だけ抽選。失敗なら通常AIを続行、成功ならその行動はスキルだけで終了。 */
export function tryEnemySkill(caster: Actor, targets: Actor[], context: Context): boolean {
  for (const id of caster.enemySkillIds ?? []) {
    const skill = ENEMY_SKILLS[id];
    if (!skill || (caster.mp ?? 0) < skill.mpCost) continue;
    if (skill.effect.type === 'allyBuff') {
      const effect = skill.effect;
      const allies = context.allies.filter(a => a.id !== caster.id && a.hp > 0 && occupied(a).some(p => Math.max(Math.abs(p.x - caster.position.x), Math.abs(p.y - caster.position.y)) <= effect.radius));
      if (!allies.length || context.rng.next() >= (caster.skillChances?.[id] ?? skill.chance)) continue;
      caster.mp = (caster.mp ?? 0) - skill.mpCost;
      for (const ally of allies) {
        ally.buffs = (ally.buffs ?? []).filter(b => b.id !== id);
        ally.buffs.push({ id, remainingTurns: effect.duration, appliedAt: context.action, attackMultiplier: effect.attackMultiplier, detectionBonus: effect.detectionBonus });
      }
      context.events.push({ type: 'trap', actorId: caster.id, position: { ...caster.position }, path: allies.map(a => ({ ...a.position })), visual: 'healingGlow', sound: skill.sound });
      context.log(caster.name + 'の' + skill.name + '！ 周囲の味方' + allies.length + '体を' + effect.duration + 'ターン強化！');
      return true;
    }
    const candidates = targets.filter(t => t.hp > 0 && (skill.target !== 'player' || t.kind === 'player') && occupied(caster).some(c => occupied(t).some(p => {
      const range = distance(c, p);
      return range >= skill.minRange && range <= skill.maxRange && (!skill.cardinalOnly || c.x === p.x || c.y === p.y) && (!skill.requiresSight || lineOfSight(context.map, c, p));
    })));
    const prepared = candidates.map(target => ({ target, action: prepare(skill, caster, target, context) })).find(entry => entry.action !== null);
    if (!prepared || !prepared.action || context.rng.next() >= (caster.skillChances?.[id] ?? skill.chance)) continue;
    const { target, action } = prepared;
    caster.mp = (caster.mp ?? 0) - skill.mpCost; caster.position = action.position; caster.facing = action.facing;
    const multiplier = skill.effect.damageMin + context.rng.next() * (skill.effect.damageMax - skill.effect.damageMin);
    // 命中ログは呼び出し元でスキル名とダメージを1件にまとめる。
    context.events.push({ type: 'attack', actorId: caster.id, position: action.origin ?? { ...caster.position }, target: action.impact ?? { ...target.position }, attribute: skill.effect.attribute, enemySkillId: id, visual: skill.visual, sound: skill.sound, path: action.path });
    context.damage(target, attackPower(caster) * multiplier, skill.effect.attribute, false, skill.name);
    return true;
  }
  return false;
}
