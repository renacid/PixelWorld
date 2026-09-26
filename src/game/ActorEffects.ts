import type { Actor } from './types';
import { actorDefinition } from '../data/enemies';
import { ATTRIBUTE_NAMES } from '../data/skills';
import { movementLocked } from './ActorStats';

/** 敵の基礎能力を開示せず、現在の効果だけを閲覧するための表示。 */
export function actorEffectDescriptions(actor: Actor, action: number): string[] {
  const effects: string[] = [];
  for (const buff of actor.buffs ?? []) {
    if (buff.remainingTurns <= 0) continue;
    const details: string[] = [];
    if (buff.attackBonus) details.push(`攻撃力＋${buff.attackBonus}`);
    if (buff.attackMultiplier !== 1) details.push(`攻撃力×${buff.attackMultiplier}`);
    if (buff.detectionBonus) details.push(`索敵範囲＋${buff.detectionBonus}`);
    for (const [name, followup] of [['雷装', buff.thunderFollowup], ['氷装', buff.iceFollowup]] as const) {
      if (followup) details.push(`${name}：${Math.round(followup.chance * 100)}％で${Math.round(followup.ratio * 100)}％の追加攻撃`);
    }
    effects.push(`${buff.name ? buff.name + '：' : ''}${details.join('・') || '強化'}（残り${buff.remainingTurns}ターン）`);
  }
  for (const affliction of actor.afflictions) if (affliction.remainingTurns > 0) effects.push(`${ATTRIBUTE_NAMES[affliction.attribute]}付着（残り${affliction.remainingTurns}ターン）`);
  if (movementLocked(actor, action)) effects.push(`移動不可（残り${Math.max(actor.movementLockedUntil ?? 0, actor.frostErosion?.rootUntil ?? 0) - action}ターン）`);
  if ((actor.stunnedUntil ?? 0) > action) effects.push(`行動不可（残り${actor.stunnedUntil! - action}ターン）`);
  if (actor.frostErosion) effects.push('霜蝕：' + (actor.frostErosion.spent ? '追加ダメージ消費済み' : '次の属性反応で追加ダメージ'));
  const weakness = actorDefinition(actor.kind).fireVulnerability;
  if (weakness) effects.push(`炎耐性低下：受ける炎ダメージ＋${weakness}（永久）`);
  if ((actor.bossLinkUntil ?? 0) > action) effects.push(`ゴブリンの絆：周囲11×11内のゴブリンが倒れると5ダメージ（残り${actor.bossLinkUntil! - action}ターン）`);
  return effects;
}
