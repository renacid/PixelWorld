import { SKILLS } from '../data/skills';
import { applyBuff } from '../game/ActorStats';
import { createSpirit, summonCells } from '../game/Summoning';
import type { Random } from '../game/Random';
import type { GameEvent, SaveData } from '../game/types';
import { effectiveLevel } from './SkillBag';
import { skillMp, wearSkill } from './SkillWear';

/** 罠・ボス進入から共通で呼ぶ。複数効果は重複なし、MPとCTは1回だけ消費。 */
export function triggerEarthBlessing(s: SaveData, rng: Random, events: GameEvent[], log: (message: string) => void): boolean {
  const id = 'earthBlessing', p = s.playerState;
  if (p.hp <= 0 || !s.skillBag.some(b => b.skillId === id && b.position) || (s.cooldowns[id] ?? 0) > 0 || p.mp < skillMp(s, id)) return false;
  const level = effectiveLevel(s.skillBag, s.skillLevels, id), growth = level - 1;
  p.mp -= skillMp(s, id); s.cooldowns[id] = SKILLS[id].cooldown;
  (s.passiveTriggeredAt ??= {})[id] = s.playerActionCount;
  if (wearSkill(s, id, rng)) log('大地の祝福が劣化した。');
  const pool = ['hp', 'mp', 'attack', 'summon'];
  for (let n = 0; n < (level >= 5 ? 3 : level >= 3 ? 2 : 1); n++) {
    const effect = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    let text: string;
    if (effect === 'hp' || effect === 'mp') {
      const value = 10 + growth * 3;
      if (effect === 'hp') { const gain = Math.min(value, p.maxHp - p.hp); p.hp += gain; text = `HP${gain}回復`; }
      else { const gain = Math.min(value, p.maxMp - p.mp); p.mp += gain; text = `MP${gain}回復`; }
    } else if (effect === 'attack') {
      applyBuff(p, { id: 'skill:earthBlessing', name: '大地の祝福', appliedAt: s.playerActionCount, remainingTurns: 15, attackBonus: 3 + growth, attackMultiplier: 1, detectionBonus: 0 });
      text = `攻撃力＋${3 + growth}（15ターン）`;
    } else {
      const cells = summonCells(s);
      if (!cells.length) { log('大地の祝福！ 精霊が現れる空きマスがなかった。'); continue; }
      const ally = createSpirit(s, 'sprite', cells[rng.int(0, cells.length - 1)]);
      ally.hp = ally.maxHp += growth * 3; ally.attack += growth; ally.remainingLife = 30 + growth * 5;
      events.push({ type: 'trap', position: { ...ally.position }, visual: 'summonRing', sound: 'magicCast' });
      text = '下級精霊を召喚';
    }
    log('大地の祝福！ ' + text);
    events.push({ type: 'heal', actorId: p.id, position: { ...p.position }, text, sound: 'healing' });
  }
  return true;
}
