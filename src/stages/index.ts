import { stage as cave2 } from './cave/3-2';
import { stage as cave1 } from './cave/3-1';
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
import { stage as s11 } from './forest/2-5';
import { stage as testStage } from './plains/test-dungeon';
export { REGIONS } from './regions';
export const STAGES: Stage[] = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s11, cave1, cave2, testStage].map(stage => {
 const defaults = REGIONS.find(r => r.id === stage.regionId)!.defaults;
 // 地域内のステージ番号1〜3は最大1冊、4以降は30%で2冊目。各ステージで上書き可能。
 return { skillBooks: { max: Number(stage.code?.split('-')[1]) >= 4 ? 2 : 1, extraChance: .3 }, ...defaults, ...stage, loot: { ...defaults.loot, ...stage.loot }, enemyDrops: { ...defaults.enemyDrops, ...stage.enemyDrops } };
});
