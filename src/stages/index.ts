/** 公開順。保存用id=1〜8は維持し、表示番号はcodeで管理。 */
import type { Stage } from '../game/types';
import { REGIONS } from './regions';
import { stage as s1 } from './plains/1-1';
import { stage as s2 } from './plains/1-2';
import { stage as s3 } from './plains/1-3';
import { stage as s4 } from './plains/1-4';
import { stage as s5 } from './plains/1-5';
import { stage as s6 } from './forest/2-1';
import { stage as s7 } from './forest/2-2';
import { stage as s9 } from './forest/2-4';
import { stage as s8 } from './forest/2-3';
export { REGIONS } from './regions';
export const STAGES: Stage[] = [s1, s2, s3, s4, s5, s6, s7, s8, s9].map(stage => {
 const defaults = REGIONS.find(r => r.id === stage.regionId)!.defaults;
 return { ...defaults, ...stage, loot: { ...defaults.loot, ...stage.loot }, enemyDrops: { ...defaults.enemyDrops, ...stage.enemyDrops } };
});
