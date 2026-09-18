/** 2-3。floorSettings[層番号]で条件・敵・地形・抽選表を上書き。 */
import type { Stage } from '../../game/types';
import { forest03 } from './layout03';
export const stage: Stage = {
  id: 8,
  name: '森 2-3',
  subtitle: 'ゴブリンの住処',
  description: '曲がりくねる獣道と輪を描く森。ゴブリンの集落を抜けよう。',
  objective: '森の出口を探そう',
  vision: 5,
  width: 41,
  height: 65,
  enemyCount: 22,
  // 各層に配置。階層別に変える場合はfloorSettingsの同名項目へ。
  installationPlacements: [{kind:'pot',count:8,nearWall:true},{kind:'goblinNest',count:2,nearWall:true}],
  sleepRespawnCount: 3,
  dungeon: {
    floors: 3,
    enemyScaling: { everyFloors: 3, multiplier: 1.2 },
    gemCount: 1,
    extraPassages: 8,
    enemyVariance: 1,
    nightRevival: { min: 1, max: 2 }
  },
  regionId: 'forest',
  code: '2-3',
  clearCondition: { type: 'exit' },
  layout: (_stage, floor) => forest03(floor)
};
