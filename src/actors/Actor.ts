import type { Actor, Player, Point } from '../game/types';
export function rectangle(width: number, height: number): Point[] { return Array.from({ length: width * height }, (_, i) => ({ x: i % width, y: Math.floor(i / width) })); }
export function actor(id: string, kind: Actor['kind'], position: Point, stage = 1): Actor {
  const stats = { player: [30, 10, 1, 1], slime: [12 + stage * 2, 2, 1, 1], wolf: [17 + stage * 2, 3, 2, 1], golem: [45, 4, 2, 2], boss: [125, 6, 3, 3], sprite: [16, 4, 1, 1] }[kind];
  const [hp, attack, w, h] = stats;
  return { id, kind, name: { player: '旅人', slime: '草スライム', wolf: '森の狼', golem: '守護岩', boss: '草原の王', sprite: '森の精霊' }[kind], position, facing: 'down', alertedAt: -1, cells: rectangle(w, h), directions: ['up', 'right', 'down', 'left'], attackCells: [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }], hp, maxHp: hp, attack, attribute: 'physical', afflictions: [], detectionRange: kind === 'wolf' ? 6 : kind === 'boss' ? 7 : 4, pattern: kind === 'slime' ? 'patrol' : 'guard', attackRange: 1, priorityTarget: 'nearest', pursuitTurns: 6, mode: 'idle', lastSeen: null, pursuitLeft: 0 };
}
export function createPlayer(): Player { return { ...actor('player', 'player', { x: 3, y: 3 }), mp: 20, maxMp: 20, criticalRate: .15, criticalMultiplier: 1.5, facing: 'down', freeCamera: false }; }
