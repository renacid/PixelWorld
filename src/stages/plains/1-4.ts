/** 1-4。floorSettings[層番号]で条件・敵・地形・抽選表を上書き。 */
import type { Stage } from '../../game/types';
export const stage: Stage = {
  id: 4,
  dungeon: {
    floors: 2,
    gemCount: 1,
    extraPassages: 16,
    enemyVariance: 1,
    nightRevival: { min: 1, max: 2 }
  },
  name: '平原 1-4',
  subtitle: 'おおかみの縄張り',
  description: 'おおかみの群れを掃討せよ',
  objective: '狼を指定数倒し、出口へ',
  vision: 5,
  width: 25,
  height: 25,
  enemyCount: 11,
  enemySpawns: [
    { kind: 'wolf', count: 1 },
    { kind: 'slime', count: 2 },
    { kind: 'wolf', count: 1 },
    { kind: 'slime', count: 2 },
    { kind: 'wolf', count: 1 },
    { kind: 'slime', count: 2 },
    { kind: 'wolf', count: 1 }
  ],
  regionId: 'plains',
  code: '1-4',
  trapPlacements: [{ count: 9 }],
  clearCondition: { type: 'defeat', kind: 'wolf', count: 3 },
  floorSettings: {
    1: { clearCondition: { type: 'defeat', kind: 'wolf', count: 3 } },
    2: { clearCondition: { type: 'defeat', kind: 'wolf', count: 4 } }
  }
};
