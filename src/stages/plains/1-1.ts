/** 1-1。floorSettings[層番号]で条件・敵・地形・抽選表を上書き。 */
import type { Stage } from '../../game/types';
export const stage: Stage = {
  id: 1,
  dungeon: {
    floors: 1,
    gemCount: 1,
    extraPassages: 16,
    enemyVariance: 1,
    nightRevival: { min: 1, max: 2 }
  },
  name: '平原 1-1',
  subtitle: 'はじまりの平原',
  description: '小さな冒険のはじまり。まずは一歩を踏み出そう。',
  objective: '古代の記録を1個回収し、出口へ',
  vision: 5,
  width: 19,
  height: 19,
  enemyCount: 5,
  enemySpawns: [{ kind: 'slime', count: 5 }],
  regionId: 'plains',
  code: '1-1',
  trapPlacements: [{ count: 6 }],
  clearCondition: { type: 'records', count: 1 }
};
