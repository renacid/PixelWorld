/** 2-1。floorSettings[層番号]で条件・敵・地形・抽選表を上書き。 */
import type { Stage } from '../../game/types';
import { upperFloorLayout } from '../shared/upperFloors';
import { forestLayout } from './layouts';
export const stage: Stage = {
  id: 6,
  dungeon: {
    floors: 3,
    enemyScaling: { everyFloors: 3, multiplier: 1.2 },
    gemCount: 1,
    extraPassages: 16,
    enemyVariance: 1,
    nightRevival: { min: 1, max: 2 }
  },
  name: '森 2-1',
  subtitle: '迷いの森',
  description: '魔物を退けながら出口を目指せ',
  objective: '森の出口を探そう',
  vision: 5,
  width: 35,
  height: 54,
  enemyCount: 12,
  sleepRespawnCount: 3,
  regionId: 'forest',
  code: '2-1',
  clearCondition: { type: 'exit' },
  layout: (stage, floor) => floor === 1 ? forestLayout(false) : upperFloorLayout(stage, floor)
};
