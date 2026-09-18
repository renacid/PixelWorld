/** 1-3。floorSettings[層番号]で条件・敵・地形・抽選表を上書き。 */
import type { Stage } from '../../game/types';
export const stage: Stage = {
  id: 3,
  dungeon: {
    floors: 2,
    gemCount: 1,
    extraPassages: 16,
    enemyVariance: 1,
    nightRevival: { min: 1, max: 2 }
  },
  name: '平原 1-3',
  subtitle: 'うす暗い獣道',
  description: '草陰に潜む狼。視線をかわし、森の向こうへ。',
  objective: '古代の記録を2個回収し、出口へ',
  vision: 5,
  width: 25,
  height: 23,
  enemyCount: 11,
  enemySpawns: [
    { kind: 'slime', count: 1 },
    { kind: 'wolf', count: 1 },
    { kind: 'slime', count: 2 },
    { kind: 'wolf', count: 1 },
    { kind: 'slime', count: 2 },
    { kind: 'wolf', count: 1 },
    { kind: 'slime', count: 2 },
    { kind: 'wolf', count: 1 }
  ],
  regionId: 'plains',
  code: '1-3',
  trapPlacements: [{ count: 8 }],
  clearCondition: { type: 'records', count: 2 }
};
