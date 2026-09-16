/** ステージ共通値と階層別の上書きを合成。宝石は仕様上、各階0〜1個に制限。 */
import type { FloorRules, Stage } from '../game/types';
export function floorRules(stage: Stage, floor = 1): FloorRules {
  const rules = { gemCount: 1, extraPassages: 12, enemyVariance: 1, nightRevival: { min: 1, max: 2 }, ...stage.dungeon, ...stage.dungeon?.overrides?.[floor] };
  return { ...rules, gemCount: Math.min(1, Math.max(0, Math.floor(rules.gemCount))) };
}
