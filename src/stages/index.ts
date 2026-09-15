import type { Stage } from '../game/types';
// Radius 5 reveals the added, half-clipped outer ring of the 11×11 view.
export const STAGES: Stage[] = [
  { id: 1, name: '平原1', subtitle: 'はじまりの小径', description: '古い宝箱と、小さな冒険。まずは一歩を踏み出そう。', objective: '古代の宝箱を1個回収し、出口へ', vision: 5, width: 19, height: 19, enemyCount: 5, goal: 'treasure', requiredChests: 1 },
  { id: 2, name: '平原2', subtitle: '見張りの森', description: '草陰に潜む狼。視線をかわし、森の向こうへ。', objective: '見張りの森を抜け、出口へ', vision: 5, width: 23, height: 21, enemyCount: 9, goal: 'exit', requiredChests: 0 },
  { id: 3, name: '平原3', subtitle: '忘れられた庭', description: '持てる道具は3つ。何を残し、何を持ち帰る？', objective: '古代の宝箱を2個回収し、出口へ', vision: 5, width: 25, height: 23, enemyCount: 11, goal: 'treasure', requiredChests: 2 },
  { id: 4, name: '平原4', subtitle: '雷鳴の遺跡', description: '大きな足音と、足元の火種。属性を味方に。', objective: '遺跡の守護岩を倒し、出口へ', vision: 5, width: 25, height: 25, enemyCount: 11, goal: 'hunt', requiredChests: 0 },
  { id: 5, name: '平原5', subtitle: '草原の王', description: '旅路の先で待つ巨影。すべての力をひとつに。', objective: '草原の王を倒し、出口へ', vision: 5, width: 27, height: 25, enemyCount: 10, goal: 'boss', requiredChests: 0 },
];
