/** 1-5。floorSettings[層番号]で条件・敵・地形・抽選表を上書き。 */
import type { Stage } from '../../game/types';
export const stage: Stage = {
  id: 5,
  dungeon: {
    floors: 2,
    gemCount: 1,
    extraPassages: 16,
    enemyVariance: 1,
    nightRevival: { min: 1, max: 2 }
  },
  name: '平原 1-5',
  subtitle: '廃棄された村',
  description: '住み着いたゴブリンを駆逐せよ',
  objective: '第2層のゴーレムを倒し、出口へ',
  vision: 5,
  width: 27,
  height: 25,
  enemyCount: 10,
  enemySpawns: [
    { kind: 'goblin', count: 4 },
    { kind: 'slime', count: 2 },
    { kind: 'wolf', count: 1 },
    { kind: 'slime', count: 2 }
  ],
  regionId: 'plains',
  code: '1-5',
  trapPlacements: [{ count: 10 }],
  clearCondition: { type: 'exit' },
  floorSettings: {
    2: {
      clearCondition: { type: 'defeat', kind: 'golem', count: 1 },
      enemySpawns: [{ kind: 'golem', count: 1 }, { kind: 'goblin', count: 4 }, { kind: 'wolf', count: 2 }]
    }
  }
};
