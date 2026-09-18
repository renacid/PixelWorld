/** ステージ共通値と階層別の上書きを合成。宝石は仕様上、各階1〜2個に制限。 */
import type { FloorRules, Stage } from '../game/types';
export function floorRules(stage: Stage, floor = 1): FloorRules {
  const rules = { gemCount: 1, extraPassages: 12, enemyVariance: 1, nightRevival: { min: 1, max: 2 }, ...stage.dungeon, ...stage.dungeon?.overrides?.[floor] };
  return { ...rules, gemCount: Math.min(1, Math.max(0, Math.floor(rules.gemCount))) };
}

/** 地域→ステージ→階層の順に上書き。配列は置き換え、抽選カテゴリは個別継承。 */
export function stageForFloor(stage: Stage, floor = 1): Stage {
 const override = stage.floorSettings?.[floor];
 const result = { ...stage, ...override, loot: { ...stage.loot, ...override?.loot }, enemyDrops: { ...stage.enemyDrops, ...override?.enemyDrops } };
 return result;
}
