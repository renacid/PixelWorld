/** 1-2。floorSettings[層番号]で条件・敵・地形・抽選表を上書き。 */
import type { Stage } from '../../game/types';
export const stage: Stage = {
  id: 2,
  dungeon: {
    floors: 1,
    gemCount: 1,
    extraPassages: 16,
    enemyVariance: 1,
    nightRevival: { min: 1, max: 2 }
  },
  name: '平原 1-2',
  subtitle: '荒れ果てた平原',
  description: '放置された平原の調査へ',
  objective: '戦闘を回避しながら、出口へ',
  vision: 5,
  width: 23,
  height: 21,
  enemyCount: 9,
  enemySpawns: [
    { kind: 'slime', count: 1 },
    { kind: 'wolf', count: 1 },
    { kind: 'slime', count: 2 },
    { kind: 'wolf', count: 1 },
    { kind: 'slime', count: 2 },
    { kind: 'wolf', count: 1 },
    { kind: 'slime', count: 1 }
  ],
  regionId: 'plains',
  code: '1-2',
  trapPlacements: [{ count: 7 }],
  clearCondition: { type: 'exit' }
};
