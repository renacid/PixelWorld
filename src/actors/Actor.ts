/** キャラクターの基礎値・占有セルを生成。正方形1・4・9マスのみ。追跡間隔はchaseMoveLimit、回復確率はchaseRecoveryChance。 */
import type { Actor, Player, Point } from '../game/types';
import { STAGES } from '../stages';
import { actorDefinition } from '../data/enemies';
export function isSquareFootprint(cells: Point[]): boolean {
  const side = Math.sqrt(cells.length);
  return [1, 2, 3].includes(side) && new Set(cells.map(c => `${c.x},${c.y}`)).size === cells.length && cells.every(c => Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0 && c.x < side && c.y < side);
}
export function rectangle(width: number, height: number): Point[] { if (width !== height || ![1, 2, 3].includes(width)) throw new Error('占有サイズは1×1・2×2・3×3のみです。'); return Array.from({ length: width * height }, (_, i) => ({ x: i % width, y: Math.floor(i / width) })); }
export function actor(id: string, kind: Actor['kind'], position: Point, stage = 1, floor = 1): Actor {
  const d = actorDefinition(kind);
  // 第3層から1.2倍、第6層から1.44倍。再生成する敵にも同じ基準値から適用。
  const rule = STAGES.find(s => s.id === stage)?.dungeon?.enemyScaling;
  const multiplier = kind !== 'player' && kind !== 'sprite' && rule ? rule.multiplier ** Math.floor(floor / Math.max(1, rule.everyFloors)) : 1;
  const hp = Math.floor((d.hp + stage * d.hpPerStage) * multiplier), mp = Math.floor(d.mp * multiplier);
  // 配列は複製し、プレイ中の変更が共通定義や別の敵へ漏れないようにします。
  return {
    wideAttack: d.wideAttack, skillSelection: d.skillSelection,
    criticalRate: d.criticalRate, criticalMultiplier: d.criticalMultiplier,
    immobile: d.immobile, skillChances: { ...d.skillChances }, buffs: [],
    id, kind, name: d.name, position: { ...position }, facing: 'down', alertedAt: -1,
    hp, maxHp: hp, attack: Math.floor(d.attack * multiplier), cells: rectangle(d.size, d.size),
    mp, maxMp: mp, enemySkillIds: [...d.skills], attribute: d.attribute === 'earth' ? 'nature' : d.attribute, afflictions: d.innateAttribute && d.innateAttribute !== 'wind' ? [{ attribute: d.innateAttribute, remainingTurns: 10, appliedAt: 0 }] : [],
    directions: [...d.directions], attackCells: d.attackCells.map(c => ({ ...c })),
    detectionRange: d.detectionRange, pattern: d.pattern, attackRange: d.attackRange,
    priorityTarget: d.priorityTarget, pursuitTurns: d.pursuitTurns,
    chaseMoveLimit: d.chaseMoveLimit, chaseRecoveryChance: d.chaseRecoveryChance,
    chaseMoves: 0, chaseSkipLeft: 0, mode: 'idle', lastSeen: null, pursuitLeft: 0,
  };
}
export function createPlayer(): Player { const d = actorDefinition('player'); return { ...actor('player', 'player', { x: 3, y: 3 }), mp: d.mp, maxMp: d.mp, criticalRate: d.criticalRate, criticalMultiplier: d.criticalMultiplier, facing: 'down', freeCamera: false, visionBonus: 0 }; }
